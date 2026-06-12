/**
 * PixelCat — 入口，仅做 wiring
 */
(async function() {
  // 1. 初始化 UI 组件
  Bubble.init();
  Settings.init();
  Sprite.init();
  Media.init();

  // 2. 加载 API Key
  if (window.pixelcat) {
    try {
      const s = await window.pixelcat.getSettings();
      if (s.apiKey) AI.setKey(s.apiKey);
      console.log('[PixelCat] Key:', s.apiKey ? 'loaded' : 'not set');
    } catch {}
  }

  // 3. 空格键：拍照 + 默认提问
  let spacePressed = false;
  document.addEventListener('keydown', async e => {
    if (e.code !== 'Space' || spacePressed || e.repeat) return;
    e.preventDefault();
    spacePressed = true;
    State.go('listening');

    const ok = await Media.start();
    if (!ok) { spacePressed = false; State.go('error', { text: '摄像头权限被拒绝' }); return; }
    await Media.startRecord();
  });

  document.addEventListener('keyup', async e => {
    if (e.code !== 'Space' || !spacePressed) return;
    e.preventDefault();
    spacePressed = false;
    if (State.current !== 'listening') return;

    const audio = await Media.stopRecord();
    const frame = Media.captureFrame();
    Media.stop();
    Bubble.hide();

    if (!AI.isReady()) {
      State.go('error', { text: '请右键设置 API Key' });
      return;
    }

    State.go('thinking');

    try {
      // Omni：音频 + 图片 + 文字一起发
      const reply = await AI.chat({ text: '请根据画面和语音回复', image: frame, audio: audio || undefined });
      State.go('speaking', { text: reply });
      TTS.speak(reply)
    } catch (e) {
      State.go('error', { text: e.message });
    }
  });

  // 4. 双击：文字输入
  document.getElementById('pet').addEventListener('dblclick', async () => {
    const area = document.getElementById('text-input-area');
    const input = document.getElementById('text-input');
    area.style.display = 'block';
    input.value = '';
    input.focus();

    if (!AI.isReady()) {
      State.go('error', { text: '请右键设置 API Key' });
      area.style.display = 'none';
      return;
    }

    const ok = await Media.start();
    if (!ok) { area.style.display = 'none'; return; }

    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      area.style.display = 'none';
      input.removeEventListener('keydown', onKey);
      State.go('thinking');
      Bubble.hide();

      const frame = Media.captureFrame();
      Media.stop();

      try {
        const reply = await AI.chat({ text, image: frame });
        State.go('speaking', { text: reply });
        TTS.speak(reply)
      } catch (e) {
        State.go('error', { text: e.message });
      }
    };

    const onKey = e => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { area.style.display = 'none'; input.removeEventListener('keydown', onKey); Media.stop(); }
    };
    input.addEventListener('keydown', onKey);
  });

  // 5. 窗口失焦时清理
  window.addEventListener('blur', () => {
    if (spacePressed) { spacePressed = false; Media.stop(); }
  });

  // 6. 空闲 15 分钟 → 睡觉
  let lastActive = Date.now();
  document.addEventListener('click', () => { lastActive = Date.now(); if (State.current === 'sleeping') State.go('idle'); });
  setInterval(() => {
    if (Date.now() - lastActive > 15 * 60 * 1000 && State.current === 'idle') {
      State.go('sleeping');
    }
  }, 30000);

  console.log('[PixelCat] Ready');
})();
