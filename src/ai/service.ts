import { createLogger } from '../main/infra/logger';
import { makeError } from '../main/infra/errors';
import { getEffectiveSettings } from '../main/settings-store';
import { buildContext, type ConversationContext } from './context';

const logger = createLogger('ai-service');

export async function* sendVisionMessage(
  text: string,
  imageBase64: string | undefined,
  ctx: ConversationContext,
): AsyncGenerator<string> {
  const eff = getEffectiveSettings();
  const apiKey = eff.apiKey || '';
  const model = 'qwen-vl-max';

  const messages = buildContext(ctx);

  // Build user message with optional image
  const content: any[] = [];
  if (imageBase64) {
    content.push({ type: 'image_url', image_url: { url: imageBase64 } });
  }
  content.push({ type: 'text', text: text || '你好' });

  messages.push({ role: 'user', content });

  logger.info('AI request', { model, hasImage: !!imageBase64 });

  const resp = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        stream: true,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    logger.error('AI error', { status: resp.status, body: errText.slice(0, 200) });
    if (resp.status === 401) throw makeError('AI_INVALID_KEY');
    if (resp.status === 429) throw makeError('AI_RATE_LIMIT');
    throw makeError('AI_MODEL_ERROR', { status: resp.status });
  }

  if (!resp.body) throw makeError('AI_EMPTY_RESP');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data);
        const token = chunk?.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {}
    }
  }
}
