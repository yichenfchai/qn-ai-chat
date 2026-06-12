/**
 * 对话气泡 UI
 * 监听 State 变化，独立渲染
 */
const Bubble = {
  _el: null,
  _visible: false,

  init() {
    this._el = document.getElementById('speech-bubble');
    State.on('change', ({ to, data }) => {
      if (to === 'speaking' && data?.text) this.show(data.text);
      else if (to === 'thinking') this.show('...');
      else if (to === 'idle') this.hide();
    });
  },

  /** 流式追加文字 */
  append(text) {
    if (!this._el) return;
    if (!this._visible) {
      this._el.textContent = text;
      this._el.classList.add('visible');
      this._visible = true;
    } else {
      this._el.textContent += text;
    }
  },

  show(text) {
    if (!this._el) return;
    this._el.textContent = text;
    this._el.classList.add('visible');
    this._visible = true;
  },

  hide() {
    if (!this._el) return;
    this._el.classList.remove('visible');
    this._visible = false;
  },
};
