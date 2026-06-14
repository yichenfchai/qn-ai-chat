/**
 * PixelCat — 入口，仅做 wiring
 *
 * 交互模型:
 *   单击猫 → 唤醒摄像头 + 麦克风
 *   长按猫 → 录制声音 + 画面
 *   松手   → 停止录制，发送给 AI
 *   点桌面 → 关闭摄像头
 *   右键   → 设置面板
 *   双击   → 文字输入
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
      if (s.model) AI.setModel(s.model);
      if (s.baseUrl) AI.setBaseUrl(s.baseUrl);
    } catch {}
  }


  const statusDot = document.getElementById('status-indicator');

  function setAwake(on) {
    if (on) statusDot.classList.add('awake');
    else statusDot.classList.remove('awake', 'recording');
  }
  function setRecording(on) {
    if (on) { statusDot.classList.remove('awake'); statusDot.classList.add('recording'); }
    else statusDot.classList.remove('recording');
  }

  let cameraOn = false;
  let interacting = false;

  function tryInteract() {
    if (interacting || Agent.isBusy()) {
      Bubble.show('等一下喵~');
      return false;
    }
    interacting = true;
    return true;
  }

  Sprite.onClick = async () => {
    if (cameraOn) return;
    const ok = await Media.start();
    if (ok) {
      cameraOn = true;
      setAwake(true);
      State.go('awake');
      Bubble.show('喵~');
      setTimeout(() => { if (State.current === 'awake') Bubble.hide(); }, 1500);
    } else {
      State.go('error', { text: '摄像头权限被拒绝' });
    }
  };

  Sprite.onRecordStart = async () => {
    if (!cameraOn) {
      const ok = await Media.start();
      if (!ok) { Sprite._isRecording = false; return; }
      cameraOn = true;
    }
    await Media.startRecord();
    setRecording(true);
    State.go('listening');
    Bubble.show('正在听...');
  };

  Sprite.onRecordEnd = async () => {
    if (!tryInteract()) {
      Media.stopRecord();
      return;
    }
    const audio = await Media.stopRecord();
    setRecording(false);
    const frame = Media.captureFrame();
    Bubble.hide();
    if (!AI.isReady()) {
      interacting = false;
      State.go('error', { text: '请右键设置 API Key' });
      return;
    }
    State.go('thinking');
    try {
      const reply = await AI.chat({
        text: '请根据画面和语音回复',
        image: frame,
        audio: audio || undefined,
      });
      State.go('speaking', { text: reply });
      TTS.speak(reply);
      const tr = await Tool.execute(reply);
      if (tr) {
        if (typeof tr === 'string' && tr.startsWith('data:')) {
          const f2 = await AI.chat({ text: '分析这个截图' });
          Bubble.show(f2); TTS.speak(f2);
        } else { Bubble.show(tr); }
      }
    } catch (e) {
      State.go('error', { text: e.message });
    } finally {
      interacting = false;
    }
  };

  window.addEventListener('blur', () => {
    if (!cameraOn) return;
    Media.shutdown();
    cameraOn = false;
    setAwake(false);
    Bubble.hide();
    State.go('idle');
  });

  document.getElementById('pet').addEventListener('dblclick', async () => {
    if (!tryInteract()) return;
    const area = document.getElementById('text-input-area');
    const input = document.getElementById('text-input');
    area.style.display = 'block';
    input.value = '';
    input.focus();
    if (!AI.isReady()) {
      State.go('error', { text: '请右键设置 API Key' });
      area.style.display = 'none';
      interacting = false;
      return;
    }
    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      area.style.display = 'none';
      input.removeEventListener('keydown', onKey);
      Bubble.hide();
      State.go('thinking');
      try {
        let augmentedText = text;
        if (typeof WeatherAgent !== 'undefined') {
          try { const aug = await WeatherAgent.augment(text); if (aug) augmentedText = aug; } catch {}
        }
        const { reply } = await Agent.run({ text: augmentedText });
        State.go('speaking', { text: reply });
        TTS.speak(reply);
        const tr = await Tool.execute(reply);
        if (tr) {
          if (typeof tr === 'string' && tr.startsWith('data:')) {
            const f2 = await AI.chat({ text: '分析这个截图' });
            Bubble.show(f2); TTS.speak(f2);
          } else { Bubble.show(tr); }
        }
      } catch (e) {
        State.go('error', { text: e.message });
      } finally {
        interacting = false;
      }
    };
    const onKey = e => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { area.style.display = 'none'; input.removeEventListener('keydown', onKey); interacting = false; }
    };
    input.addEventListener('keydown', onKey);
  });

  let lastActive = Date.now();
  document.addEventListener('click', () => { lastActive = Date.now(); if (State.current === 'sleeping') State.go('idle'); });
  setInterval(() => { if (Date.now() - lastActive > 15*60*1000 && State.current === 'idle') State.go('sleeping'); }, 30000);
})();
