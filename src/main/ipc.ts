import { ipcMain, BrowserWindow, desktopCapturer } from 'electron';
import { exec, spawn } from 'child_process';
import { createLogger } from './infra/logger';
import { loadSettings, saveSettings } from './settings-store';
import { executeTool } from '../agent/executor';
import { AGENT_TOOLS } from '../agent/schema';
import type { AgentIPCRequest, AgentIPCResponse } from '../agent/types';
import { TOOL_TIMEOUTS } from '../agent/types';

const logger = createLogger('ipc');

export function registerIPCHandlers() {
  logger.info('Registering IPC handlers');

  // ── 已有: ping ──────────────────────────────────
  ipcMain.on('ping', (event, replyChannel: string) => {
    event.reply(replyChannel, { pong: true, ts: Date.now() });
  });

  // ── 已有: 窗口移动 ──────────────────────────────
  ipcMain.on('window:move', (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [x, y] = win.getPosition();
      win.setPosition(x + dx, y + dy);
    }
  });

  // ── 已有: 设置读写 ──────────────────────────────
ipcMain.handle('settings:get', async () => {
    try { return loadSettings(); }
    catch(e: any) { return {}; }
  });

  ipcMain.handle('settings:save', async (_event, settings: any) => {
    try {
      saveSettings(settings);
      return { ok: true };
    } catch(e: any) {
      return { ok: false, error: e.message };
    }
  });

  // ── 已有: 语音识别 token ────────────────────────
  ipcMain.on('nls:getToken', (event, replyChannel: string) => {
    event.reply(replyChannel, {
      appKey: process.env.NLS_APP_KEY || '',
      url: 'wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1',
    });
  });

  // ── 新增: Agent 工具定义获取（单源） ───────────

  /**
   * agent:getTools — 渲染进程获取工具定义
   * 单次拉取后缓存，保证与主进程 schema.ts 完全一致
   */
  ipcMain.on('agent:getTools', (event, replyChannel: string) => {
    try {
      event.reply(replyChannel, { ok: true, tools: AGENT_TOOLS });
    } catch (e) {
      event.reply(replyChannel, { ok: false, error: (e as Error).message });
    }
  });

  // ── 新增: Agent 工具执行 ─────────────────────────

  /**
   * agent:execute — 渲染进程委托主进程执行一个 agent 工具
   *
   * 协议:
   *   渲染 → 主: send('agent:execute', replyChannel, request)
   *   主 → 渲染: reply(replyChannel, response)
   *
   * 竞态安全: 每次请求携带唯一 callId，replyChannel = 'agent:result:' + callId
   */
  ipcMain.on('agent:execute', (event, replyChannel: string, rawRequest: any) => {
    const request = rawRequest as AgentIPCRequest;

    logger.info('Agent execute request', {
      callId: request.callId,
      tool: request.name,
    });

    // 超时定时器
    const timeoutMs = TOOL_TIMEOUTS[request.name] || 10000;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      const response: AgentIPCResponse = {
        callId: request.callId,
        status: 'error',
        error: `工具执行超时 (${timeoutMs / 1000}s)`,
        code: 'AGENT_TIMEOUT',
      };
      try { event.reply(replyChannel, response); } catch {}
    }, timeoutMs);

    // 执行工具
    executeTool({
      callId: request.callId,
      name: request.name,
      arguments: request.arguments,
    })
      .then(result => {
        if (timedOut) return;
        clearTimeout(timer);
        const response: AgentIPCResponse = {
          callId: request.callId,
          status: result.status,
          output: result.status === 'success' ? result.output : undefined,
          error: result.status === 'error' ? result.error : undefined,
          code: result.status === 'error' ? result.code : undefined,
        };
        try { event.reply(replyChannel, response); } catch (e) {
          logger.warn('Failed to send agent IPC reply', { callId: request.callId });
        }
      })
      .catch(err => {
        if (timedOut) return;
        clearTimeout(timer);
        const response: AgentIPCResponse = {
          callId: request.callId,
          status: 'error',
          error: `执行器内部错误: ${(err as Error).message}`,
          code: 'EXECUTION_ERROR',
        };
        try { event.reply(replyChannel, response); } catch {}
      });
  });

  ipcMain.handle('tool:screenshot', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return '';
    try {
      const img = await win.webContents.capturePage();
      const buf = img.toJPEG(80);
      const base64 = buf.toString('base64');
      return 'data:image/jpeg;base64,' + base64;
    } catch(e: any) {
      logger.error('Screenshot failed', { error: e.message });
      return '';
    }
  });

  ipcMain.handle('tool:openApp', async (_event, appName: string) => {
    const cmds: Record<string, string> = {
      'vscode': 'code',
      'vs code': 'code',
      'chrome': 'start /B chrome',
      'edge': 'start /B msedge',
      'notepad': 'notepad',
      '记事本': 'notepad',
      'calc': 'calc',
      '计算器': 'calc',
      'cmd': 'start /B cmd',
      'terminal': 'start /B cmd',
      'explorer': 'explorer',
      '资源管理器': 'explorer',
      'wps': 'start /B wps',
      'word': 'start /B winword',
      'excel': 'start /B excel',
      'ppt': 'start /B powerpnt',
      'powerpoint': 'start /B powerpnt',
      '画图': 'start /B mspaint',
      'mspaint': 'start /B mspaint',
    };
    const cmd = cmds[appName.toLowerCase()] || `start /B ${appName}`;
    logger.info('Opening app', { cmd });
    // spawn + windowsHide（win+wps 这类不在 PATH 的需 shell:true 走 start 查找）
    try {
      const proc = spawn(cmd, [], {
        windowsHide: true,
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
      return `已打开 ${appName}`;
    } catch (e: any) {
      return `打开失败: ${e.message}`;
    }
  });

  // === on/send 模式（仅用于高频操作） ===

  ipcMain.on('window:move', (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [x, y] = win.getPosition();
      win.setPosition(x + dx, y + dy);
    }
  });

  logger.info('IPC handlers registered');
}
