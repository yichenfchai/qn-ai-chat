/**
 * 极简事件总线 — 供 UI 组件订阅
 * 不再管理交互状态（交互由 app.js 的 _pending 处理）
 */
const State = {
  _listeners: {},

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error('State listener error:', e); }
    });
  },
};
