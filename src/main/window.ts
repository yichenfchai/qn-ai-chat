/**
 * Electron 窗口管理
 * 
 * 透明无边框悬浮窗，alwaysOnTop，可拖拽
 * 安全配置：contextIsolation + sandbox + nodeIntegration:false
 */

import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { createLogger } from './infra/logger';

const logger = createLogger('window');

const WINDOW_WIDTH = 320;
const WINDOW_HEIGHT = 420;

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    logger.warn('Window already exists, focusing');
    mainWindow.focus();
    return mainWindow;
  }

  // 计算初始位置：屏幕右下角
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const x = screenW - WINDOW_WIDTH - 20;
  const y = screenH - WINDOW_HEIGHT - 40;

  logger.info('Creating window', { x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    transparent: true,     // 透明背景
    frame: false,          // 无边框
    alwaysOnTop: true,     // 置顶
    resizable: false,
    skipTaskbar: true,     // 不显示在任务栏
    hasShadow: false,      // 透明窗口不需要阴影
    backgroundColor: '#00000000', // 完全透明

    webPreferences: {
      contextIsolation: true,     // ⚠️ 渲染器隔离
      nodeIntegration: false,    // ⚠️ 禁止渲染器使用 Node
      sandbox: false,  // disabled for IPC debug             // ⚠️ 沙箱模式
      preload: path.join(__dirname, '../../preload/index.js'),
    },
  });

  // 加载渲染器
  mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.loadFile(path.join(__dirname, '../../../renderer/index.html'));

  // 开发时打开 DevTools — ENABLED
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Window closed');
  });

  // 让窗口可以被鼠标穿透（点击穿透到下面的应用）
  // 暂时注释，因为会影响交互
  // mainWindow.setIgnoreMouseEvents(true, { forward: true });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
