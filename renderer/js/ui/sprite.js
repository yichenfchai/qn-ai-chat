/**
 * 精灵图交互 — 只负责 DOM 事件 → 语义事件
 * 不耦合任何业务逻辑
 *
 * 事件:
 *   pet:wake    单击猫 → 唤醒摄像头
 *   pet:record  按住猫 → 开始录音
 *   pet:send    松开猫 → 发送语音
 *   pet:sleep   点别处 → 关闭摄像头
 */
const Sprite = {
  _pet: null,
  _holding: false,
  _holdTimer: null,

  init() {
    this._pet = document.getElementById('pet');

    // 单击 → 唤醒
    this._pet.addEventListener('click', e => {
      e.stopPropagation();
      State.emit('pet:wake');
    });

    // 按住 → 录音
    this._pet.addEventListener('mousedown', e => {
      e.stopPropagation();
      this._holding = true;
      // 300ms 后确认是按住（不是单击）
      clearTimeout(this._holdTimer);
      this._holdTimer = setTimeout(() => {
        if (this._holding) State.emit('pet:record');
      }, 300);
    });

    // 松开 → 发送
    this._pet.addEventListener('mouseup', e => {
      e.stopPropagation();
      clearTimeout(this._holdTimer);
      if (this._holding) {
        this._holding = false;
        State.emit('pet:send');
      }
    });

    // mouseleave → 取消按住
    this._pet.addEventListener('mouseleave', () => {
      clearTimeout(this._holdTimer);
      this._holding = false;
    });
  },
};
