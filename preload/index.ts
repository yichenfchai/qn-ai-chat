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

  // ===== AI 对话（Day 1 下午实现） =====
  // sendMessage: (text: string, imageBase64?: string): Promise<AIResponse> =>
  //   ipcRenderer.invoke('ai:sendMessage', text, imageBase64),

  // ===== Agent 工具（Day 2 上午实现） =====
  // execute: (tool: string, params: unknown): Promise<AgentResult> =>
  //   ipcRenderer.invoke('agent:execute', tool, params),

  // ===== 用户画像（Day 2 上午实现） =====
  // getProfile: (): Promise<UserProfile> =>
  //   ipcRenderer.invoke('profile:get'),
  // updateProfile: (updates: Partial<UserProfile>): Promise<void> =>
  //   ipcRenderer.invoke('profile:update', updates),

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
