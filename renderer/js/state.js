/**
 * 状态机 — 事件驱动，不依赖任何模块
 * 
 * 使用：state.on('change', (newState, oldState) => { ... })
 */
const State = {
  _current: 'idle',
  _listeners: {},

  /** 监听事件 */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  },

  /** 触发事件 */
  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data, this._current));
  },

  /** 获取当前状态 */
  get current() { return this._current; },

  /** 切换状态 */
  go(newState, data) {
    const old = this._current;
    if (old === newState) return;
    this._current = newState;
    this._emit('change', { from: old, to: newState, data });
  },
};
