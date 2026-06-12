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

  ipcMain.on('ai-chat', async (event, replyChannel: string, data: any) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) { event.reply(replyChannel, ''); return; }

    const { text, imageBase64, audioBase64 } = data || {};

    try {
      const { sendVisionMessage } = await import('../ai/service');
      const { createContext } = await import('../ai/context');
      const ctx = createContext('');
      let fullResponse = '';

      for await (const token of sendVisionMessage(text || '', imageBase64, ctx)) {
        fullResponse += token;
        win.webContents.send('ai:streamToken', token);
      }

      win.webContents.send('ai:streamEnd');
      event.reply(replyChannel, fullResponse);
    } catch (err: any) {
      logger.error('AI error', { message: err.message, code: err.code });
      win.webContents.send('ai:streamError', {
        code: err.code || 'UNKNOWN',
        message: err.message || '未知错误',
      });
      event.reply(replyChannel, '');
    }
  });

  logger.info('IPC handlers registered');
}
