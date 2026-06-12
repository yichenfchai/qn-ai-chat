/**
 * PixelCat 渲染进程入口
 */

(function () {
  'use strict';

  // 错误边界
  window.addEventListener('error', (event) => {
    console.error('[PixelCat] Error:', event.error);
    if (stateMachine) {
      stateMachine.transition('error', {
        message: '出了点问题...',
        detail: event.error ? event.error.message : String(event),
      });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[PixelCat] Rejection:', event.reason);
    if (stateMachine) {
      stateMachine.transition('error', { message: '网络好像不太稳定喵...' });
    }
  });

  // IPC 检查
  async function checkIPC() {
    if (!window.pixelcat) return false;
    try {
      await window.pixelcat.ping();
      return true;
    } catch { return false; }
  }

  // 空格键：按住说话
  let spacePressed = false;

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !spacePressed && !event.repeat) {
      event.preventDefault();
      spacePressed = true;
      resetIdleTimer();
      stateMachine.transition('listening');
      console.log('[PixelCat] Space pressed - listening');
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && spacePressed) {
      event.preventDefault();
      spacePressed = false;
      if (stateMachine.state === 'listening') {
        stateMachine.transition('thinking');
        console.log('[PixelCat] Space released - thinking');

        // TODO: Day1下午 - 实际发送给AI
        setTimeout(() => {
          stateMachine.transition('speaking', {
            text: '喵~ 我听到你说话了！但AI还没接上，这是占位回复。'
          });
          setTimeout(() => {
            stateMachine.transition('idle');
          }, 3000);
        }, 1500);
      }
    }
  });

  window.addEventListener('blur', () => {
    if (spacePressed) {
      spacePressed = false;
      if (stateMachine.state === 'listening') {
        stateMachine.transition('idle');
      }
    }
  });

  // 启动
  async function init() {
    console.log('[PixelCat] Starting...', {
      electron: !!window.pixelcat,
    });
    await checkIPC();
    console.log('[PixelCat] Ready');
  }

  init();
})();
