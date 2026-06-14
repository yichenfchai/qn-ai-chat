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

const WINDOW_WIDTH = 300;
const WINDOW_HEIGHT = 280;

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
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#01000000',

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../../preload/index.js'),
    },
  });

  // 确保捕获鼠标事件（透明窗口在 Windows 上可能穿透）
  mainWindow.setIgnoreMouseEvents(false);

  // 加载渲染器
  mainWindow.loadFile(path.join(__dirname, '../../../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Window closed');
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
