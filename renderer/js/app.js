/**
 * PixelCat 渲染进程主入口
 * 
 * 职责：
 *   - 初始化渲染器
 *   - 连接主进程（IPC ping 检查）
 *   - 全局错误捕获
 *   - 键盘快捷键（按住空格说话）
 */

(function () {
  'use strict';

  // ---- 全局错误边界 ----
  window.addEventListener('error', (event) => {
    console.error('[PixelCat] Uncaught error:', event.error);
    if (stateMachine) {
      stateMachine.transition('error', {
        message: '出了点问题...',
        detail: event.error ? event.error.message : String(event),
      });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[PixelCat] Unhandled rejection:', event.reason);
    if (stateMachine) {
      stateMachine.transition('error', {
        message: '网络好像不太稳定喵...',
      });
    }
  });

  // ---- IPC 通信检查 ----
  async function checkIPC() {
    if (!window.pixelcat) {
      console.warn('[PixelCat] preload API not available');
      return false;
    }

    try {
      const result = await window.pixelcat.ping();
      console.log('[PixelCat] IPC connected:', result);
      return true;
    } catch (err) {
      console.error('[PixelCat] IPC ping failed:', err);
      return false;
    }
  }

  // ---- 空格键：按住说话 ----
  let spacePressed = false;
  let spaceTimer = null;

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !spacePressed && !event.repeat) {
      event.preventDefault();
      spacePressed = true;

      resetIdleTimer();
      stateMachine.transition('listening');

      console.log('[PixelCat] Space pressed — listening...');
      // 实际录音逻辑在 media-capture.js 中（Day 1 下午实现）
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && spacePressed) {
      event.preventDefault();
      spacePressed = false;

      if (stateMachine.state === 'listening') {
        stateMachine.transition('thinking');
        console.log('[PixelCat] Space released — thinking...');
        // 实际发送逻辑在 Day 1 下午实现
      }
    }
  });

  // ---- 窗口失去焦点时恢复空闲 ----
  window.addEventListener('blur', () => {
    if (spacePressed) {
      spacePressed = false;
    }
    if (stateMachine && stateMachine.state === 'listening') {
      stateMachine.transition('idle');
    }
  });

  // ---- 启动 ----
  async function init() {
    console.log('[PixelCat] Starting renderer...');

    // 版本信息
    console.log('[PixelCat]', {
      userAgent: navigator.userAgent,
      electron: !!window.pixelcat,
      webSpeech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      speechSynthesis: !!window.speechSynthesis,
    });

    // 检查 IPC
    const ipcOk = await checkIPC();
    if (!ipcOk) {
      console.warn('[PixelCat] IPC not available yet, retrying...');
      // Electron preload 可能还没加载完，稍后重试
      setTimeout(async () => {
        const retry = await checkIPC();
        console.log('[PixelCat] IPC retry:', retry ? 'OK' : 'FAILED');
      }, 1000);
    }

    console.log('[PixelCat] Renderer ready');
  }

  init();
})();
