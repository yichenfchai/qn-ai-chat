/**
 * 像素猫渲染引擎
 * 
 * 纯 CSS 猫的 DOM 结构生成 + 动画控制
 * 包含：眨眼定时器、表情切换、拖拽交互
 */

/**
 * 创建猫的 DOM 结构（在 #cat 中）
 */
function buildCatDOM() {
  const cat = document.getElementById('cat');
  if (!cat) return;

  cat.innerHTML = `
    <!-- 耳朵 -->
    <div class="cat-ear left"></div>
    <div class="cat-ear right"></div>

    <!-- 头部 -->
    <div class="cat-head">
      <div class="cat-face">
        <!-- 眼睛 -->
        <div class="cat-eye left">
          <div class="cat-pupil"></div>
        </div>
        <div class="cat-eye right">
          <div class="cat-pupil"></div>
        </div>
        <!-- 嘴巴 -->
        <div class="cat-mouth happy"></div>
        <!-- 胡须 -->
        <div class="cat-whisker l1"></div>
        <div class="cat-whisker l2"></div>
        <div class="cat-whisker r1"></div>
        <div class="cat-whisker r2"></div>
      </div>
    </div>

    <!-- 身体 -->
    <div class="cat-body">
      <div class="cat-belly"></div>
    </div>

    <!-- 前爪 -->
    <div class="cat-paw left"></div>
    <div class="cat-paw right"></div>

    <!-- 尾巴 -->
    <div class="cat-tail"></div>
  `;
}

/**
 * 随机眨眼
 * 间隔 3-8 秒，闭眼 100ms
 */
function startBlinkTimer() {
  function scheduleBlink() {
    const delay = 3000 + Math.random() * 5000; // 3-8 秒
    setTimeout(() => {
      const cat = document.getElementById('cat');
      if (!cat) return;

      // 如果猫在睡觉或说话，不眨眼（已经有闭眼动画了）
      if (cat.classList.contains('sleeping') || cat.classList.contains('speaking')) {
        scheduleBlink();
        return;
      }

      // 眨眼
      cat.classList.add('blinking');
      setTimeout(() => {
        cat.classList.remove('blinking');
        // 偶尔连续眨眼
        if (Math.random() < 0.2) {
          setTimeout(() => {
            if (cat) cat.classList.add('blinking');
            setTimeout(() => {
              if (cat) cat.classList.remove('blinking');
              scheduleBlink();
            }, 80);
          }, 150);
        } else {
          scheduleBlink();
        }
      }, 100);
    }, delay);
  }

  scheduleBlink();
}

/**
 * 初始化拖拽移动（通过 drag-handle 区域）
 */
function initDragHandle() {
  const handle = document.getElementById('drag-handle');
  if (!handle) return;

  let isDragging = false;
  let startX, startY;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // 通过 IPC 通知主进程移动窗口
    if (window.pixelcat && window.pixelcat.moveWindow) {
      window.pixelcat.moveWindow(e.screenX - startX, e.screenY - startY);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

/**
 * 初始化空闲打哈欠定时器 (5 分钟无交互)
 */
let lastInteraction = Date.now();
let yawnTimer = null;

function resetIdleTimer() {
  lastInteraction = Date.now();
  // 如果猫在睡觉，唤醒
  if (stateMachine.state === 'sleeping') {
    showZZZ(false);
    stateMachine.transition('idle');
  }
}

function startIdleTimers() {
  // 打哈欠检查（每 30 秒检查一次）
  setInterval(() => {
    const idleTime = Date.now() - lastInteraction;
    const cat = document.getElementById('cat');
    if (!cat) return;

    // 5 分钟 → 打哈欠
    if (idleTime > 5 * 60 * 1000 && 
        !cat.classList.contains('sleeping') &&
        stateMachine.state === 'idle') {
      cat.classList.add('excited'); // 借用 excited 的动画
      setTimeout(() => cat.classList.remove('excited'), 600);
    }

    // 15 分钟 → 睡觉
    if (idleTime > 15 * 60 * 1000 && stateMachine.state === 'idle') {
      stateMachine.transition('sleeping');
    }
  }, 30000);
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  buildCatDOM();
  startBlinkTimer();
  startIdleTimers();

  // 点击猫 → 切换开心表情
  const cat = document.getElementById('cat');
  if (cat) {
    cat.addEventListener('click', (e) => {
      // 阻止拖拽区域误触发
      if (e.target.closest('#drag-handle')) return;

      resetIdleTimer();
      cat.classList.add('excited');
      setTimeout(() => cat.classList.remove('excited'), 500);
    });
  }

  console.log('[PixelCat] Renderer initialized');
});
