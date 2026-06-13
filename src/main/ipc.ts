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

  // TODO: AI 对话处理器（Day 1 下午）
  // ipcMain.handle('ai:sendMessage', async (_, text: string, imageBase64?: string) => { ... });

  // TODO: Agent 执行处理器（Day 2 上午）
  // ipcMain.handle('agent:execute', async (_, tool: string, params: unknown) => { ... });

  // TODO: 画像处理器（Day 2 上午）
  // ipcMain.handle('profile:get', async () => { ... });
  // ipcMain.handle('profile:update', async (_, updates: unknown) => { ... });

  logger.info('IPC handlers registered');
}
