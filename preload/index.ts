/**
 * Preload 脚本 — contextBridge 安全桥接
 * 
 * ⚠️ 这是 Main ↔ Renderer 的唯一通信通道
 * 只暴露白名单 API，Renderer 无法直接访问 Node.js
 */

import { contextBridge, ipcRenderer } from 'electron';

/** 暴露给渲染进程的 API */
const pixelcatAPI = {
  /** 健康检查 */
  ping: (): Promise<{ pong: boolean; ts: number }> =>
    ipcRenderer.invoke('ping'),

  /** AI 对话（流式）*/
  sendMessage: (text: string, imageBase64?: string): Promise<string> =>
    ipcRenderer.invoke('ai:sendMessage', text, imageBase64),

  /** 监听流式 token */
  onStreamToken: (callback: (token: string) => void): void => {
    ipcRenderer.on('ai:streamToken', (_event, token: string) => callback(token));
  },

  /** 监听流结束 */
  onStreamEnd: (callback: () => void): void => {
    ipcRenderer.on('ai:streamEnd', () => callback());
  },

  /** 监听流错误 */
  onStreamError: (callback: (error: { code: string; message: string }) => void): void => {
    ipcRenderer.on('ai:streamError', (_event, error) => callback(error));
  },

  /** 拖拽移动窗口 */
  moveWindow: (dx: number, dy: number): void => {
    ipcRenderer.send('window:move', dx, dy);
  },

  /** 监听主进程事件 */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const validChannels = ['cat:stateChange', 'cat:error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  /** 移除监听 */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('pixelcat', pixelcatAPI);

// 类型声明（渲染进程用 JSDoc 引用）
export type PixelCatAPI = typeof pixelcatAPI;
