/**
 * Preload 脚本 — contextBridge 安全桥接
 */

import { contextBridge, ipcRenderer } from 'electron';

/** 暴露给渲染进程的 API — 使用 send/on 替代 invoke（Electron bug workaround） */
const pixelcatAPI = {
  ping: (): Promise<{ pong: boolean; ts: number }> =>
    new Promise((resolve) => {
      const channel = 'ping-' + Date.now();
      ipcRenderer.once(channel, (_event, result) => resolve(result));
      ipcRenderer.send('ping', channel);
    }),

  moveWindow: (dx: number, dy: number): void => {
    ipcRenderer.send('window:move', dx, dy);
  },

  getNLSToken: (): Promise<{ appKey: string; url: string }> =>
    new Promise((resolve) => {
      const channel = 'nls-token-' + Date.now();
      ipcRenderer.once(channel, (_event, result) => resolve(result));
      ipcRenderer.send('nls:getToken', channel);
    }),

  sendMessage: (text: string, imageBase64?: string, audioBase64?: string): Promise<string> =>
    new Promise((resolve) => {
      const channel = 'ai-msg-' + Date.now();
      ipcRenderer.once(channel, (_event, result) => resolve(result));
      ipcRenderer.send('ai:sendMessage', channel, text, imageBase64, audioBase64);
    }),

  onStreamToken: (callback: (token: string) => void): void => {
    ipcRenderer.on('ai:streamToken', (_event, token: string) => callback(token));
  },

  onStreamEnd: (callback: () => void): void => {
    ipcRenderer.on('ai:streamEnd', () => callback());
  },

  onStreamError: (callback: (error: { code: string; message: string }) => void): void => {
    ipcRenderer.on('ai:streamError', (_event, error) => callback(error));
  },

  getSettings: (): Promise<any> =>
    new Promise((resolve) => {
      const channel = 'settings-get-' + Date.now();
      ipcRenderer.once(channel, (_event, result) => resolve(result));
      ipcRenderer.send('settings:get', channel);
    }),

  saveSettings: (settings: any): Promise<any> =>
    new Promise((resolve) => {
      const channel = 'settings-save-' + Date.now();
      ipcRenderer.once(channel, (_event, result) => resolve(result));
      ipcRenderer.send('settings:save', channel, settings);
    }),

  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const validChannels = ['cat:stateChange', 'cat:error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Test marker
document.addEventListener('DOMContentLoaded', () => {
  const marker = document.createElement('div');
  marker.id = 'preload-marker';
  marker.textContent = 'PRELOAD OK';
  marker.style.cssText = 'position:absolute;top:0;left:0;color:#0f0;font-size:10px;z-index:999;';
  document.body?.appendChild(marker);
});

contextBridge.exposeInMainWorld('pixelcat', pixelcatAPI);
