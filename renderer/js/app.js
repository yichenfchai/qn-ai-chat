/**
 * PixelCat — wiring 层
 * 职责: 连接 Sprite 事件 → Media/API/TTS/Bubble
 * 不包含业务逻辑
 */
(async function() {
  Bubble.init();
  Settings.init();
  Sprite.init();
  Media.init();

  if (window.pixelcat) {
    try {
      const s = await window.pixelcat.getSettings();
      if (s.apiKey) AI.setKey(s.apiKey);
    } catch {}
  }

  let _pending = false;
  let _lockTimer = null;

  function lock() {
    _pending = true;
    clearTimeout(_lockTimer);
    _lockTimer = setTimeout(unlock, 15000);
  }
  function unlock() {
    _pending = false;
    clearTimeout(_lockTimer);
    _lockTimer = null;
  }

  function tip(msg) { Bubble.show(msg); setTimeout(() => { if (!_pending) Bubble.hide(); }, 2000); }

  async function interact({ text, audio, image }) {
    Bubble.show('...');

    // WeatherAgent 预处理：检测天气/日期查询 → 注入数据
    if (text && typeof WeatherAgent !== 'undefined') {
      try {
        const augmented = await WeatherAgent.augment(text);
        if (augmented) text = augmented;
      } catch (e) { /* 静默降级 */ }
    }

    const reply = await AI.chat({
      text: text || '请根据画面和语音回复',
      image,
      audio: audio || undefined,
      onToken: (token) => { Bubble.append(token); },
    });
    Bubble.show(reply);
    TTS.speak(reply);

    const tr = await Tool.execute(reply);
    if (tr) {
      if (tr.startsWith && tr.startsWith('data:')) {
        Bubble.show('...');
        const f2 = await AI.chat({ text: '分析这个截图', image: tr });
        Bubble.show(f2);
        TTS.speak(f2);
      } else {
        Bubble.show(tr);
      }
    }
  }

  // === Wiring: Sprite 事件 → 行为 ===

  // 单击猫 → 唤醒摄像头
  State.on('pet:wake', async () => {
    if (_pending) return;
    const ok = await Media.start();
    if (ok !== true) tip('摄像头打开失败');
  });

  // 按住猫 → 开始录音
  State.on('pet:record', () => {
    if (_pending) { tip('请稍等...'); return; }
    Media.startRecord();
  });

  // 松开猫 → 发送语音
  State.on('pet:send', async () => {
    if (_pending) return;
    if (!Media._recorder) return;

    lock();
    try {
      const audio = await Media.stopRecord();
      const frame = Media.captureFrame();
      if (!AI.isReady()) { tip('请右键设置 API Key'); return; }

      document.getElementById('pet').classList.add('thinking');
      await interact({ audio, image: frame });
    } catch (err) {
      tip(err.message || '出错了');
    } finally {
      document.getElementById('pet').classList.remove('thinking');
      unlock();
    }
  });

  // 点别处 → 关摄像头
  document.addEventListener('click', () => {
    Media.shutdown();
  });

  // === 双击：文字输入 ===
  document.getElementById('pet').addEventListener('dblclick', async e => {
    e.stopPropagation();
    if (_pending) { tip('请稍等...'); return; }

    lock();
    const area = document.getElementById('text-input-area');
    const input = document.getElementById('text-input');
    area.style.display = 'block';
    input.value = '';
    input.focus();

    if (!AI.isReady()) { tip('请右键设置 API Key'); area.style.display = 'none'; unlock(); return; }

    const ok = await Media.start();
    if (ok !== true) { area.style.display = 'none'; unlock(); return; }

    let submitted = false;
    const submit = async () => {
      if (submitted) return;
      const text = input.value.trim();
      if (!text) return;
      submitted = true;
      area.style.display = 'none';
      input.removeEventListener('keydown', onKey);

      try {
        const frame = Media.captureFrame();
        document.getElementById('pet').classList.add('thinking');
        await interact({ text, image: frame });
      } catch (err) {
        tip(err.message || '出错了');
      } finally {
        document.getElementById('pet').classList.remove('thinking');
        unlock();
      }
    };

    const onKey = e => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { area.style.display = 'none'; input.removeEventListener('keydown', onKey); unlock(); }
    };
    input.addEventListener('keydown', onKey);
  });

  // === 失焦关摄像头 ===
  window.addEventListener('blur', () => { Media.shutdown(); });

  console.log('[PixelCat] Ready');
})();
