import { ipcMain, BrowserWindow } from 'electron';
import { createLogger } from './infra/logger';
import { loadSettings, saveSettings } from './settings-store';
import * as child_process from 'child_process';

const logger = createLogger('ipc');

export function registerIPCHandlers() {
  logger.info('Registering IPC handlers');

  // === invoke/handle 模式（Electron 推荐，自带 Promise + 错误传播） ===

  ipcMain.handle('ping', async () => {
    return { pong: true, ts: Date.now() };
  });

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
      'chrome': 'start chrome',
      'edge': 'start msedge',
      'notepad': 'notepad',
      '记事本': 'notepad',
      'calc': 'calc',
      '计算器': 'calc',
      'cmd': 'start cmd',
      'terminal': 'start cmd',
      'explorer': 'explorer',
      '资源管理器': 'explorer',
      'wps': 'start wps',
      'word': 'start winword',
      'excel': 'start excel',
      'ppt': 'start powerpnt',
      'powerpoint': 'start powerpnt',
      '画图': 'start mspaint',
      'mspaint': 'start mspaint',
    };
    const cmd = cmds[appName.toLowerCase()] || `start ${appName}`;
    logger.info('Opening app', { cmd });
    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(`打开超时: ${appName}`);
      }, 5000);
      child_process.exec(cmd, (err) => {
        clearTimeout(timeout);
        resolve(err ? `打开失败: ${err.message}` : `已打开 ${appName}`);
      });
    });
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
