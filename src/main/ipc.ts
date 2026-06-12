/**
 * IPC 处理器注册 — 使用 send/on 模式（Electron invoke bug workaround）
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createLogger } from './infra/logger';
import { loadSettings, saveSettings } from './settings-store';

const logger = createLogger('ipc');

export interface IPCContext {
  // 预留
}

/** 初始化所有 IPC 处理器 */
export function registerIPCHandlers(ctx: IPCContext): void {
  logger.info('Registering IPC handlers');

  // Ping
  ipcMain.on('ping', (event, replyChannel: string) => {
    event.reply(replyChannel, { pong: true, ts: Date.now() });
  });

  // 窗口拖拽
  ipcMain.on('window:move', (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [x, y] = win.getPosition();
      win.setPosition(x + dx, y + dy);
    }
  });

  // NLS Token
  ipcMain.on('nls:getToken', (event, replyChannel: string) => {
    const { getEffectiveSettings } = require('./settings-store');
    const eff = getEffectiveSettings();
    event.reply(replyChannel, {
      appKey: eff.nlsAppKey || process.env.NLS_APP_KEY || '',
      url: 'wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1',
    });
  });

  // 设置读写
  ipcMain.on('settings:get', (event, replyChannel: string) => {
    try {
      event.reply(replyChannel, loadSettings());
    } catch (e: any) {
      logger.error('settings:get failed', { error: e.message });
      event.reply(replyChannel, {});
    }
  });

  ipcMain.on('settings:save', (event, replyChannel: string, settings: any) => {
    console.log('=== settings:save CALLED ===');
    try {
      saveSettings(settings);
      console.log('Settings saved');
      event.reply(replyChannel, { ok: true });
    } catch (e: any) {
      console.log('Save error:', e.message);
      event.reply(replyChannel, { ok: false, error: e.message });
    }
  });

  // AI 对话（Qwen-Omni：音频+图片+文字）
  ipcMain.on('ai:sendMessage', async (event, replyChannel: string, text: string, imageBase64?: string, audioBase64?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) { event.reply(replyChannel, ''); return; }

    try {
      const { sendOmniMessage } = await import('../ai/service');
      const { createContext } = await import('../ai/context');
      const ctx = createContext('');
      let fullResponse = '';

      for await (const token of sendOmniMessage(text, audioBase64 || undefined, imageBase64 || undefined, ctx)) {
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
