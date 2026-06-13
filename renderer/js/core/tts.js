/**
 * 语音合成 — Web Speech API
 */
const TTS = {
  _endCallbacks: [],

  /** 注册 TTS 结束回调 */
  onEnd(fn) {
    this._endCallbacks.push(fn);
  },

  /** 朗读前清理符号 */
  _clean(text) {
    return text
      .replace(/\([◕ᴗ•́︿̀･ω･=^]+\)/g, '')   // 颜文字
      .replace(/喵~?/g, '喵')                  // 统一喵
      .replace(/[*_~`#]/g, '')                 // markdown符号
      .replace(/[🎉🐱😊💕✨]/g, '')      // emoji
      .replace(/\s+/g, ' ')
      .trim();
  },

  speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const clean = this._clean(text);
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'zh-CN';
    u.rate = 1.1;
    u.volume = 0.8;
    u.onend = () => {
      this._endCallbacks.forEach(fn => { try { fn(); } catch(e) {} });
    };
    u.onerror = () => {
      this._endCallbacks.forEach(fn => { try { fn(); } catch(e) {} });
    };
    window.speechSynthesis.speak(u);
  },
};
