import { ipcMain, BrowserWindow } from 'electron';
import { createLogger } from './infra/logger';
import { loadSettings, saveSettings } from './settings-store';

const logger = createLogger('ipc');

export function registerIPCHandlers() {
  logger.info('Registering IPC handlers');

  ipcMain.on('ping', (event, replyChannel: string) => {
    event.reply(replyChannel, { pong: true, ts: Date.now() });
  });

  ipcMain.on('window:move', (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [x, y] = win.getPosition();
      win.setPosition(x + dx, y + dy);
    }
  });

  ipcMain.on('settings:get', (event, replyChannel: string) => {
    try { event.reply(replyChannel, loadSettings()); }
    catch(e: any) { event.reply(replyChannel, {}); }
  });

  ipcMain.on('settings:save', (event, replyChannel: string, settings: any) => {
    try {
      saveSettings(settings);
      event.reply(replyChannel, { ok: true });
    } catch(e: any) {
      event.reply(replyChannel, { ok: false, error: e.message });
    }
  });

  ipcMain.on('nls:getToken', (event, replyChannel: string) => {
    event.reply(replyChannel, {
      appKey: process.env.NLS_APP_KEY || '',
      url: 'wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1',
    });
  });

    // AI moved to renderer
  logger.info('IPC handlers registered');
}
