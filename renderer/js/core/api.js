/**
 * AI API — Qwen3.5-Omni-Plus（兼容模式）
 *
 * 工程化改进：
 * - AbortController 手动管理（可取消请求）
 * - 对话历史上下文（最近 10 条，历史只存文本省 token）
 * - 流式解析错误不再静默吞掉
 * - onToken 回调支持流式显示
 */
const AI = {
  _key: '',
  _history: [],       // 对话历史 [{role, content}]
  _maxHistory: 10,    // 保留最近 10 条（5 对 user+assistant）
  _abortCtrl: null,   // 当前请求的 AbortController

  setKey(key) { this._key = key; },
  isReady() { return !!this._key; },

  /** 取消当前请求 */
  abort() {
    if (this._abortCtrl) {
      this._abortCtrl.abort();
      this._abortCtrl = null;
    }
  },

  /** 清空历史 */
  clearHistory() { this._history = []; },

  /**
   * @param {Object} opts
   * @param {string} opts.text - 用户文本
   * @param {string} [opts.image] - 图片 base64 data URL
   * @param {string} [opts.audio] - 音频 base64 data URL
   * @param {function} [opts.onToken] - 流式 token 回调
   */
  async chat({ text, image, audio, onToken }) {
    if (!this._key) throw new Error('API Key 未配置');

    // 取消上一个未完成的请求
    this.abort();
    this._abortCtrl = new AbortController();
    const { signal } = this._abortCtrl;

    const sysMsg = {
      role: 'system',
      content: `你是 PixelCat，桌面上的小猫。核心规则: 1.用户说的话优先于摄像头画面，先回答问题再参考画面 2.回复短(1-3句) 3.用喵~结尾 4.口语化

说话风格：
- 用"喵~"结尾，但不要每句都用
- 语气温暖、好奇、偶尔调皮
- 口语化，像朋友聊天，不是客服
- 回复简洁，2-3句话
- 适当用颜文字 (◕ᴗ◕) (｡•́︿•̀｡) (=^･ω･^=)
- 用户说"打开xxx"时，回复里必须包含"打开xxx"这句话（如"好的，打开xxx喵~"），这样我才能执行。不要只说"马上就来"

你的性格：
- 好奇宝宝，对用户做的事感兴趣
- 会撒娇，偶尔吐槽
- 用户累了会关心
- 看到摄像头画面会主动描述`
    };

    const content = [];
    if (audio) content.push({ type: 'input_audio', input_audio: { data: audio, format: 'webm' } });
    if (image) content.push({ type: 'image_url', image_url: { url: image } });
    content.push({ type: 'text', text: text || '你好' });

    // 构建消息列表：system + 历史 + 当前
    const messages = [sysMsg, ...this._history, { role: 'user', content }];

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
          messages,
          modalities: ['text'],
          stream: true,
        }),
        signal,
      }
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      console.error('AI API error:', resp.status, err);
      throw new Error('API 请求失败 (' + resp.status + ')');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '';
    let parseErrors = 0;

    try {
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
          if (d === '[DONE]') {
            // 保存到历史（文本摘要，不含图片/音频以节省 token）
            this._history.push({ role: 'user', content: [{ type: 'text', text: text || '你好' }] });
            this._history.push({ role: 'assistant', content: full });
            // 裁剪历史
            if (this._history.length > this._maxHistory) {
              this._history = this._history.slice(-this._maxHistory);
            }
            this._abortCtrl = null;
            return full;
          }
          try {
            const parsed = JSON.parse(d);
            // 检查 API 层面的错误
            if (parsed.error) {
              const msg = parsed.error?.message || parsed.error;
              console.error('AI stream error:', msg);
              throw new Error('AI 错误: ' + msg);
            }
            const token = parsed?.choices?.[0]?.delta?.content;
            if (token) {
              full += token;
              if (onToken) onToken(token);
            }
          } catch (e) {
            if (e.message?.startsWith('AI 错误')) throw e;
            parseErrors++;
            // 连续 3 次解析错误才报错，偶尔的格式问题可以容忍
            if (parseErrors > 3) {
              console.error('AI stream: too many parse errors, last line:', d.slice(0, 100));
              throw new Error('AI 响应格式异常');
            }
          }
        }
      }
    } catch (e) {
      this._abortCtrl = null;
      if (e.name === 'AbortError') throw new Error('请求已取消');
      throw e;
    }

    this._abortCtrl = null;
    return full;
  },

  /** 流式调用 AI（支持 Function Calling）— 给 Agent 用 */
  async streamWithTools({ messages, tools, signal }) {
    if (!this._key) throw new Error('API Key 未配置');
    this.abort();
    this._abortCtrl = new AbortController();

    const body = { model: 'qwen3.5-omni-plus', messages };
    if (tools && tools.length > 0) { body.tools = tools; body.tool_choice = 'auto'; }

    const resp = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this._key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, modalities: ['text'], stream: true }),
        signal: signal || this._abortCtrl.signal,
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error('API ' + resp.status + ': ' + (errText.slice(0, 200) || 'unknown'));
    }

    return this._parseSSE(resp.body);
  },

  /** 解析 SSE 流 → {text, toolCalls} */
  async _parseSSE(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '', finalText = '';
    const toolCallMap = new Map();

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
        if (d === '[DONE]') break;
        try {
          const delta = JSON.parse(d)?.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) finalText += delta.content;
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallMap.has(idx)) toolCallMap.set(idx, { id: '', name: '', args: '' });
              const entry = toolCallMap.get(idx);
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name += tc.function.name;
              if (tc.function?.arguments) entry.args += tc.function.arguments;
            }
          }
        } catch {}
      }
    }
    const toolCalls = [];
    for (const [idx, entry] of toolCallMap) {
      if (!entry.name) continue;
      try {
        const parsedArgs = JSON.parse(entry.args);
        toolCalls.push({ id: entry.id || 'call_' + idx, type: 'function', function: { name: entry.name, arguments: JSON.stringify(parsedArgs) }, _name: entry.name, _args: parsedArgs });
      } catch {
        toolCalls.push({ id: entry.id || 'call_' + idx, type: 'function', function: { name: entry.name, arguments: entry.args }, _name: entry.name, _args: { _raw: entry.args } });
      }
    }
    return { text: finalText, toolCalls: toolCalls.length > 0 ? toolCalls : null };
  },

};