/**
 * PixelCat — 渲染进程直接调用 AI API
 */
(function() {
  'use strict';
  let spacePressed = false;
  let apiKey = '';

  // Get API key from settings on start
  async function loadKey() {
    if (window.pixelcat) {
      try {
        const settings = await window.pixelcat.getSettings();
        apiKey = settings.apiKey || '';
        console.log('API key loaded:', apiKey ? 'yes' : 'no');
      } catch(e) { console.log('loadKey failed:', e); }
    }
  }

  // Direct API call
  async function callAI(text, imageBase64) {
    if (!apiKey) return '请先在右键设置中填入 API Key';

    const content = [];
    if (imageBase64) content.push({ type: 'image_url', image_url: { url: imageBase64 } });
    content.push({ type: 'text', text: text || '你好' });

    try {
      const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen-vl-max', messages: [{ role: 'user', content }], max_tokens: 2048, stream: true }),
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        const err = await resp.text().catch(()=>'');
        return 'API错误(' + resp.status + '): ' + err.slice(0, 100);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const d = t.slice(6);
          if (d === '[DONE]') return full;
          try {
            const token = JSON.parse(d)?.choices?.[0]?.delta?.content;
            if (token) {
              full += token;
              showSpeechBubble(full);
            }
          } catch {}
        }
      }
      return full;
    } catch(e) {
      return '网络错误: ' + e.message;
    }
  }

  // === Space key ===
  document.addEventListener('keydown', async (e) => {
    if (e.code !== 'Space' || spacePressed || e.repeat) return;
    e.preventDefault();
    spacePressed = true;
    resetIdleTimer();
    const ok = await mediaCapture.startCamera();
    if (!ok) { spacePressed = false; return; }
    mediaCapture.startListening();
    stateMachine.transition('listening');
  });

  document.addEventListener('keyup', async (e) => {
    if (e.code !== 'Space' || !spacePressed) return;
    e.preventDefault();
    spacePressed = false;
    if (stateMachine.state !== 'listening') return;
    stateMachine.transition('thinking');
    mediaCapture.stopListening();
    const frame = mediaCapture.captureFrame();
    mediaCapture.stopCamera();
    hideSpeechBubble();
    const reply = await callAI('你好，看到什么了？', frame);
    stateMachine.transition('speaking', { text: reply });
    speakText(reply);
  });

  // === Double-click typing ===
  document.getElementById('pet').addEventListener('dblclick', async () => {
    const area = document.getElementById('text-input-area');
    const input = document.getElementById('text-input');
    if (!area || !input) return;
    area.style.display = 'block'; input.value = ''; input.focus();
    await mediaCapture.startCamera();

    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      area.style.display = 'none';
      input.removeEventListener('keydown', onKey);
      resetIdleTimer(); hideSpeechBubble();
      stateMachine.transition('thinking');
      const frame = mediaCapture.captureFrame();
      mediaCapture.stopCamera();
      const reply = await callAI(text, frame);
      stateMachine.transition('speaking', { text: reply });
      speakText(reply);
    };
    const onKey = (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { area.style.display = 'none'; input.removeEventListener('keydown', onKey); mediaCapture.stopCamera(); }
    };
    input.addEventListener('keydown', onKey);
  });

  function speakText(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1.1; u.volume = 0.8;
    window.speechSynthesis.speak(u);
  }

  window.addEventListener('blur', () => {
    if (spacePressed) { spacePressed = false; mediaCapture.stopCamera(); }
  });

  loadKey();
  console.log('[PixelCat] Ready (direct API mode)');
})();
