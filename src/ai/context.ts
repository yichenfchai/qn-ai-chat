/**
 * 对话上下文管理
 * 
 * 维护最近 N 轮对话，注入系统提示词 + 用户画像
 */

import { createLogger } from '../main/infra/logger';

const logger = createLogger('ai-context');
const MAX_HISTORY = 10; // 保留最近 10 条消息

export interface ConversationContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  profileContext: string;
}

/** 系统提示词 */
const SYSTEM_PROMPT = `你是 PixelCat，一只住在用户桌面上的 AI 小猫。
你能通过摄像头看到用户，通过麦克风听到用户说话。

你的性格：
- 温暖、好奇、偶尔调皮
- 用中文回复，偶尔加"喵~"
- 回答简洁，不超过 3 句话
- 如果你看不清画面，诚实说"太黑了喵"或"我没看清"

你的能力：
- 你可以看到摄像头画面（如果用户打开了）
- 你可以执行简单的文件操作和命令行
- 你能记住用户的偏好和习惯`;

/** 构建完整消息列表 */
export function buildContext(ctx: ConversationContext) {
  const messages: Array<{ role: string; content: string }> = [];

  // 1. 系统提示词
  let systemPrompt = SYSTEM_PROMPT;
  if (ctx.profileContext) {
    systemPrompt += `\n\n关于当前用户：\n${ctx.profileContext}`;
  }
  messages.push({ role: 'system', content: systemPrompt });

  // 2. 历史对话
  const recentHistory = ctx.history.slice(-MAX_HISTORY);
  for (const msg of recentHistory) {
    messages.push(msg);
  }

  return messages;
}

/** 创建新的对话上下文 */
export function createContext(profileContext = ''): ConversationContext {
  return {
    history: [],
    profileContext,
  };
}

/** 添加一轮对话到历史 */
export function addToHistory(
  ctx: ConversationContext,
  userMsg: string,
  assistantMsg: string,
): void {
  ctx.history.push({ role: 'user', content: userMsg });
  ctx.history.push({ role: 'assistant', content: assistantMsg });

  // 保留最近 N 条
  if (ctx.history.length > MAX_HISTORY * 2) {
    ctx.history = ctx.history.slice(-MAX_HISTORY * 2);
  }

  logger.debug('History updated', { length: ctx.history.length });
}
