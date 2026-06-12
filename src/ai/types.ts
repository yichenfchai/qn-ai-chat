/**
 * AI 服务类型定义
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VisionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | VisionContent[];
}

export interface VisionContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface ChatCompletionRequest {
  model: string;
  messages: VisionMessage[];
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionChunk {
  choices: Array<{
    delta: { content?: string; role?: string };
    finish_reason: string | null;
    index: number;
  }>;
}

export interface StreamCallback {
  (token: string): void;
}

export interface AIError {
  code: string;
  message: string;
}
