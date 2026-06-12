/**
 * 精灵动画控制器
 * 
 * 使用 man1/man2/man3 三帧循环
 * 不同状态通过 pet div 的 CSS class 控制视觉效果
 */

const SPRITES = {
  idle: ['sprites/cat.png'],
};

// 帧循环已禁用 — 仅保持 w1 静态站立

/** 更新猫的表情状态（通过 CSS class 控制） */
function updateCatExpression(expression) {
  const pet = document.getElementById('pet');
  const img = document.getElementById('pet-img');
  if (!pet) return;

  // 移除所有状态类
  pet.classList.remove('thinking', 'speaking', 'error-state', 'sleeping', 'clicked');

  const classMap = {
    'thinking': 'thinking',
    'speaking': 'speaking',
    'executing': 'thinking',
    'error': 'error-state',
    'sad': 'error-state',
    'sleeping': 'sleeping',
  };

  const cls = classMap[expression];
  if (cls) pet.classList.add(cls);

  // 统一使用 w1 精灵图（暂不切换）
  if (img) img.src = SPRITES.idle[0];

  // 控制 Zzz
  showZZZ(expression === 'sleeping');
}

/** 状态指示器 */
function updateStatusIndicator(state) {
  const ind = document.getElementById('status-indicator');
  if (!ind) return;
  ind.className = state;
}

/** 对话气泡 */
function showSpeechBubble(text) {
  const bubble = document.getElementById('speech-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('visible');
}
function hideSpeechBubble() {
  const bubble = document.getElementById('speech-bubble');
  if (!bubble) return;
  bubble.classList.remove('visible');
}

/** Zzz 控制 */
function showZZZ(show) {
  const pet = document.getElementById('pet');
  if (!pet) return;

  if (show) {
    if (!pet.querySelector('.zzz')) {
      for (let i = 1; i <= 3; i++) {
        const z = document.createElement('div');
        z.className = 'zzz';
        z.textContent = 'Z';
        pet.appendChild(z);
      }
    }
  } else {
    pet.querySelectorAll('.zzz').forEach(el => el.remove());
  }
}

/** 拖拽 + 点击 */
let dragInfo = null;

function initDragAndClick() {
  const pet = document.getElementById('pet');
  if (!pet) return;

  pet.addEventListener('mousedown', (e) => {
    dragInfo = {
      screenX: e.screenX,
      screenY: e.screenY,
      moved: false,
    };
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragInfo) return;
    const dx = e.screenX - dragInfo.screenX;
    const dy = e.screenY - dragInfo.screenY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragInfo.moved = true;
      pet.classList.add('dragging');
      // 通过 IPC 通知主进程移动窗口
      if (window.pixelcat && window.pixelcat.moveWindow) {
        window.pixelcat.moveWindow(dx, dy);
      }
      dragInfo.screenX = e.screenX;
      dragInfo.screenY = e.screenY;
    }
  });

  document.addEventListener('mouseup', () => {
    if (!dragInfo) return;
    pet.classList.remove('dragging');
    if (!dragInfo.moved) {
      // 是点击，不是拖拽
      pet.classList.add('clicked');
      setTimeout(() => pet.classList.remove('clicked'), 300);
      if (typeof resetIdleTimer === 'function') resetIdleTimer();
    }
    dragInfo = null;
  });
}

/** 初始化 */
document.addEventListener('DOMContentLoaded', () => {
  initDragAndClick();
  console.log('[PixelCat] Sprite animator ready');
});
