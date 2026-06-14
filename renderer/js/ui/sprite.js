/**
 * 精灵图渲染 + 拖拽 + 单击/长按
 *
 * 单击(< 400ms 无拖动) → 唤醒摄像头麦克风
 * 长按(>= 400ms 无拖动) → 开始录制
 * 拖动(> 2px) → 移动窗口
 * 松手 → 如果录制中则停止并发送
 */

const LONGPRESS_MS = 400;
const DRAG_THRESHOLD = 2;

const Sprite = {
  _pet: null,
  _drag: null,
  _longpressTimer: null,
  _isRecording: false,
  // 回调由 app.js 注入
  onClick: null,       // 单击猫
  onRecordStart: null, // 长按开始录制
  onRecordEnd: null,   // 松手停止并发送

  init() {
    this._pet = document.getElementById('pet');

    // 阻止 click 冒泡到 document（防止误关摄像头）
    this._pet.addEventListener('click', e => e.stopPropagation());

    this._pet.addEventListener('mousedown', e => {
      this._drag = { x: e.screenX, y: e.screenY, moved: false };

      // 长按定时器
      this._longpressTimer = setTimeout(() => {
        if (this._drag && !this._drag.moved) {
          this._isRecording = true;
          this._pet.classList.add('recording');
          this.onRecordStart?.();
        }
      }, LONGPRESS_MS);
    });

    document.addEventListener('mousemove', e => {
      if (!this._drag) return;
      const dx = e.screenX - this._drag.x;
      const dy = e.screenY - this._drag.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        this._drag.moved = true;
        // 取消长按（开始拖动就不再录制）
        if (this._longpressTimer) {
          clearTimeout(this._longpressTimer);
          this._longpressTimer = null;
        }
        window.pixelcat?.moveWindow(dx, dy);
        this._drag.x = e.screenX;
        this._drag.y = e.screenY;
      }
    });

    document.addEventListener('mouseup', () => {
      if (!this._drag) return;

      // 清理长按定时器
      if (this._longpressTimer) {
        clearTimeout(this._longpressTimer);
        this._longpressTimer = null;
      }

      if (this._isRecording) {
        // 长按录制 → 松手发送
        this._isRecording = false;
        this._pet.classList.remove('recording');
        this.onRecordEnd?.();
      } else if (!this._drag.moved) {
        // 短单击（未拖动、未触发长按）→ 唤醒
        this.onClick?.();
      }
      // 如果拖动了，什么都不做（窗口已移动）

      this._drag = null;
    });

    // 状态变化时的 class 切换
    State.on('change', ({ to }) => {
      this._pet.classList.remove('thinking', 'speaking', 'error-state', 'sleeping');
      if (to === 'thinking' || to === 'speaking') this._pet.classList.add(to);
    });
  },

  /** 是否正在录制 */
  isRecording() { return this._isRecording; },
};
