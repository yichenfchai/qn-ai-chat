/**
 * AI API — Qwen3.5-Omni-Plus（兼容模式）
 */
const AI = {
  _key: '',

  setKey(key) { this._key = key; },
  isReady() { return !!this._key; },

  async chat({ text, image, audio }) {
    if (!this._key) throw new Error('API Key 未配置');

    const content = [];
    if (audio) content.push({ type: 'input_audio', input_audio: { data: audio, format: 'wav' } });
    if (image) content.push({ type: 'image_url', image_url: { url: image } });
    content.push({ type: 'text', text: text || '你好' });

    const resp = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this._key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen3.5-omni-plus',
          messages: [{ role: 'user', content }],
          modalities: ['text'],
          stream: true,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      console.error('Omni error:', err);
      throw new Error('API ' + resp.status);
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
          if (token) full += token;
        } catch {}
      }
    }
    return full;
  },
};
