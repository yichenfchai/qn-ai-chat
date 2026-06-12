/**
 * 精灵动画控制器
 * 
 * 使用 man1/man2/man3 三帧循环
 * 不同状态通过 pet div 的 CSS class 控制视觉效果
 */

const SPRITES = {
  idle:    ['sprites/man1.png', 'sprites/man2.png', 'sprites/man3.png'],
  working: ['sprites/w1.png',   'sprites/w2.png',   'sprites/w3.png'],
};

// 暂不启用帧循环动画，保持站立姿态
// const FRAME_DELAY = 20;
// 三帧动画循环代码保留备用，需要时取消注释即可

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

  // 状态切换精灵图：thinking/speaking/executing → working(w1), 其余 → idle(man1)
  if (img) {
    const workingStates = ['thinking', 'speaking', 'executing'];
    if (workingStates.includes(expression)) {
      img.src = SPRITES.working[0];  // w1 站立
    } else {
      img.src = SPRITES.idle[0];     // man1 站立
    }
  }

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

/** 点击反馈 */
function initClickHandler() {
  const pet = document.getElementById('pet');
  if (!pet) return;

  pet.addEventListener('click', (e) => {
    if (e.target.closest('#drag-handle')) return;
    pet.classList.add('clicked');
    setTimeout(() => pet.classList.remove('clicked'), 300);
    // 重置空闲计时器
    if (typeof resetIdleTimer === 'function') resetIdleTimer();
  });
}

/** 初始化 */
document.addEventListener('DOMContentLoaded', () => {
  initClickHandler();
  console.log('[PixelCat] Sprite animator ready');
});
