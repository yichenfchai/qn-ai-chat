/**
 * AI 服务 — Qwen-Omni 多模态调用
 * 支持音频+图片+文字一次性输入
 */

import { getConfig } from '../main/infra/config';
import { createLogger } from '../main/infra/logger';
import { makeError } from '../main/infra/errors';
import { getEffectiveSettings } from '../main/settings-store';
import { buildContext, type ConversationContext } from './context';

const logger = createLogger('ai-service');

export async function* sendOmniMessage(
  text: string,
  audioBase64: string | undefined,
  imageBase64: string | undefined,
  ctx: ConversationContext,
): AsyncGenerator<string> {
  const eff = getEffectiveSettings();
  const apiKey = eff.apiKey || process.env.AI_API_KEY || getConfig().DEEPSEEK_API_KEY;

  const messages = buildContext(ctx);

  // 构建多模态内容
  const content: any[] = [{ text: text || '（用户没有说话，请根据画面回复）' }];

  if (imageBase64) {
    content.push({ image: imageBase64 });
  }
  if (audioBase64) {
    content.push({ audio: audioBase64 });
  }

  const userMsg = { role: 'user', content };
  const allMessages = [...messages, userMsg];

  logger.info('Omni request', {
    hasImage: !!imageBase64,
    hasAudio: !!audioBase64,
    audioSize: audioBase64 ? Math.round(audioBase64.length / 1024) + 'KB' : 'N/A',
  });

  const resp = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-omni-turbo',
        input: { messages: allMessages },
        parameters: { max_tokens: 2048 },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    logger.error('Omni error', { status: resp.status, body: errText.slice(0, 200) });
    if (resp.status === 401) throw makeError('AI_INVALID_KEY');
    throw makeError('AI_MODEL_ERROR', { status: resp.status });
  }

  const data = await resp.json();
  const reply = data?.output?.choices?.[0]?.message?.content?.[0]?.text || '';

  if (reply) {
    yield reply;
  } else {
    throw makeError('AI_EMPTY_RESP');
  }
}
