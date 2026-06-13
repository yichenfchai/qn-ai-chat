/**
 * PixelCat — AI 桌面宠物
 * 
 * Electron 主进程入口
 * 
 * 启动顺序：
 *   1. 加载 .env 环境变量
 *   2. 校验配置
 *   3. 创建透明悬浮窗
 *   4. 注册 IPC 处理器
 */

import { app } from 'electron';
import * as path from 'path';

// 必须在最前面加载 dotenv（Electron 主进程中 process.cwd() 是 app 目录）
// 用绝对路径加载项目根目录的 .env
try {
  const dotenvPath = path.join(__dirname, '../../../.env');
  require('dotenv').config({ path: dotenvPath });
} catch {
  // dotenv 是可选的，如果没安装就跳过（用系统环境变量）
}

import { createLogger, setLogLevel, LogLevel } from './infra/logger';
import { validateConfig, setConfig } from './infra/config';
import { createMainWindow } from './window';
import { registerIPCHandlers } from './ipc';

const logger = createLogger('main');

// 设置日志级别（从环境变量读取）
const logLevelStr = (process.env.LOG_LEVEL || 'info').toUpperCase();
const logLevelMap: Record<string, LogLevel> = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
};
setLogLevel(logLevelMap[logLevelStr] ?? LogLevel.INFO);

logger.info('PixelCat starting...', {
  node: process.version,
  electron: process.versions.electron,
  platform: process.platform,
});

// ⚠️ 安全加固：禁止 GPU 相关漏洞利用
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

// 单实例锁（防止多开）
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logger.warn('Another instance is running, quitting');
  app.quit();
}

// 当用户尝试启动第二个实例时，聚焦已有窗口
app.on('second-instance', () => {
  const win = require('./window').getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// 应用就绪
app.whenReady().then(() => {
  // 0. 授予摄像头/麦克风权限（Electron 需要显式处理）
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler(
    (_webContents: any, permission: string, callback: Function) => {
      const allowed = ['media', 'mediaKeySystem', 'camera', 'microphone'];
      callback(allowed.includes(permission));
    }
  );

  // 1. 校验配置
  const config = validateConfig();
  if (!config) {
    // validateConfig 内部已经弹窗 + app.quit()
    return;
  }
  setConfig(config);

  // 2. 创建窗口
  const win = createMainWindow();

  // 3. 注册 IPC
  registerIPCHandlers();

  logger.info('PixelCat ready!');
});

// macOS: 关闭所有窗口时不退出（桌面宠物的行为）
app.on('window-all-closed', () => {
  // Windows/Linux 上关闭窗口就退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 防止退出时崩溃
app.on('before-quit', () => {
  logger.info('PixelCat shutting down');
});

// 全局未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    message: error.message,
    stack: error.stack,
  });
  // 不退出，桌面宠物应该尽量保持存活
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});
