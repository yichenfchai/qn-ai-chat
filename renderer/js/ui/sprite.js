/**
 * 精灵图渲染 + 拖拽 + 点击/双击
 */
const Sprite = {
  init() {
    const pet = document.getElementById('pet');
    const img = document.getElementById('pet-img');

    // 拖拽
    let drag = null;
    pet.addEventListener('mousedown', e => {
      drag = { x: e.screenX, y: e.screenY, moved: false };
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      if (Math.abs(e.screenX - drag.x) > 2 || Math.abs(e.screenY - drag.y) > 2) {
        drag.moved = true;
        window.pixelcat?.moveWindow(e.screenX - drag.x, e.screenY - drag.y);
        drag.x = e.screenX;
        drag.y = e.screenY;
      }
    });
    document.addEventListener('mouseup', () => {
      if (drag && !drag.moved) {
        pet.classList.add('clicked');
        setTimeout(() => pet.classList.remove('clicked'), 300);
      }
      drag = null;
    });

    // 双击 → typing mode (handled in app.js)
    // 单点 → reset idle timer (external concern)

    State.on('change', ({ to }) => {
      pet.classList.remove('thinking', 'speaking', 'error-state', 'sleeping');
      if (to === 'thinking' || to === 'speaking') pet.classList.add(to);
    });
  },
};
