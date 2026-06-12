/**
 * AI 服务 — 多模态流式调用
 * 
 * 支持 OpenAI 兼容 API（DeepSeek/Qwen-VL/GPT-4o 等）
 * 通过 .env 配置 AI_BASE_URL / AI_MODEL / AI_API_KEY
 */

import { getConfig } from '../main/infra/config';
import { createLogger } from '../main/infra/logger';
import { makeError } from '../main/infra/errors';
import type { VisionMessage, ChatCompletionChunk, VisionContent } from './types';
import { buildContext, type ConversationContext } from './context';

const logger = createLogger('ai-service');

/** 解析 SSE 流 */
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatCompletionChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const chunk: ChatCompletionChunk = JSON.parse(data);
          yield chunk;
        } catch {
          // 跳过解析失败的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 发送多模态消息（流式） */
export async function* sendVisionMessage(
  text: string,
  imageBase64: string | undefined,
  ctx: ConversationContext,
): AsyncGenerator<string> {
  const config = getConfig();
  const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.AI_MODEL || 'deepseek-v4-pro';
  const apiKey = process.env.AI_API_KEY || config.DEEPSEEK_API_KEY;

  // 构建消息
  const messages = buildContext(ctx);

  // 当前用户消息（文本 + 可选图片）
  const userContent: VisionContent[] = [];

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageBase64, detail: 'low' },
    });
  }

  userContent.push({
    type: 'text',
    text: imageBase64
      ? `（用户对着摄像头说）${text}`
      : text,
  });

  const userMessage: VisionMessage = {
    role: 'user',
    content: userContent,
  };

  const allMessages = [
    ...messages.map(m => ({ role: m.role, content: m.content } as VisionMessage)),
    userMessage,
  ];

  logger.info('AI request', {
    model,
    messagesCount: allMessages.length,
    hasImage: !!imageBase64,
    imageSize: imageBase64 ? Math.round(imageBase64.length / 1024) + 'KB' : 'N/A',
  });

  // 发送请求
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s 超时

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: true,
        max_tokens: config.MAX_TOKENS,
        temperature: config.TEMPERATURE,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('AI API error', { status: response.status, body: errText.slice(0, 200) });

      if (response.status === 401 || response.status === 403) {
        throw makeError('AI_INVALID_KEY');
      } else if (response.status === 429) {
        throw makeError('AI_RATE_LIMIT');
      } else {
        throw makeError('AI_MODEL_ERROR', { status: response.status, body: errText });
      }
    }

    if (!response.body) {
      throw makeError('AI_EMPTY_RESP');
    }

    let tokenCount = 0;
    for await (const chunk of parseSSE(response.body)) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        tokenCount++;
        yield content;
      }
    }

    logger.info('AI response complete', { tokenCount });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw makeError('AI_TIMEOUT');
    }
    // 如果已经是 AppError，直接抛
    if (err.code && err.recoverable !== undefined) {
      throw err;
    }
    // 网络错误
    logger.error('AI request failed', { message: err.message });
    throw makeError('NETWORK_ERROR', { detail: err.message });
  } finally {
    clearTimeout(timeout);
  }
}

