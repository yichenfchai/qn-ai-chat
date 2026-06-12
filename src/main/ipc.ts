/**
 * IPC 处理器注册
 * 
 * 所有 Renderer → Main 的通信通过这里
 * 使用 ipcMain.handle 实现请求-响应模式
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createLogger } from './infra/logger';

const logger = createLogger('ipc');

export interface IPCContext {
  // 后续各模块会在这里添加自己的 handler
}

/** 初始化所有 IPC 处理器 */
export function registerIPCHandlers(ctx: IPCContext): void {
  logger.info('Registering IPC handlers');

  // 健康检查
  ipcMain.handle('ping', () => {
    return { pong: true, ts: Date.now() };
  });

  // 窗口拖拽
  ipcMain.on('window:move', (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [x, y] = win.getPosition();
      win.setPosition(x + dx, y + dy);
    }
  });

  // AI 对话（流式）
  ipcMain.handle('ai:sendMessage', async (event, text: string, imageBase64?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return '';

    try {
      // 动态导入 AI service（避免启动时加载）
      const { sendVisionMessage } = await import('../ai/service');
      const { createContext } = await import('../ai/context');

      const ctx = createContext(''); // TODO: 注入用户画像
      let fullResponse = '';

      for await (const token of sendVisionMessage(text, imageBase64 || undefined, ctx)) {
        fullResponse += token;
        // 每个 token 推送给渲染进程
        win.webContents.send('ai:streamToken', token);
      }

      win.webContents.send('ai:streamEnd');
      return fullResponse;
    } catch (err: any) {
      logger.error('AI handler error', { message: err.message, code: err.code });
      win.webContents.send('ai:streamError', {
        code: err.code || 'UNKNOWN',
        message: err.message || '未知错误',
      });
      return '';
    }
  });

  // TODO: AI 对话处理器（Day 1 下午）
  // ipcMain.handle('ai:sendMessage', async (_, text: string, imageBase64?: string) => { ... });

  // TODO: Agent 执行处理器（Day 2 上午）
  // ipcMain.handle('agent:execute', async (_, tool: string, params: unknown) => { ... });

  // TODO: 画像处理器（Day 2 上午）
  // ipcMain.handle('profile:get', async () => { ... });
  // ipcMain.handle('profile:update', async (_, updates: unknown) => { ... });

  logger.info('IPC handlers registered');
}
