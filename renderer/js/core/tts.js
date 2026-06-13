/**
 * 语音合成 — Web Speech API
 * 纯函数，无 DOM 依赖
 */
const TTS = {
  /** 朗读文字 */
  speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1.1;
    u.volume = 0.8;
    window.speechSynthesis.speak(u);
  },
};
