/**
 * Agent 工具系统 — 共享类型定义
 *
 * 设计原则：
 *   1. 主进程/渲染进程/测试 三方共享同一类型定义
 *   2. 每个 ToolCall 携带唯一 callId，杜绝竞态
 *   3. 执行器完全无状态——输入 ToolCall、输出 ToolResult
 */

// ──── Tool Definition ────────────────────────────────────────

/**
 * OpenAI-compatible Function Calling tool shape.
 * 与 Qwen / DeepSeek / OpenAI API 兼容。
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ──── Tool Execution ─────────────────────────────────────────

/** 工具调用请求（来自 AI 模型 → 传入执行器） */
export interface ToolCall {
  /** 全局唯一 ID，用于 IPC 请求-响应匹配 */
  callId: string;
  /** 工具名称，必须与 ToolDefinition.function.name 一致 */
  name: string;
  /** 模型生成的参数 */
  arguments: Record<string, unknown>;
}

/** 工具调用结果（执行器 → AI 模型） */
export type ToolResult =
  | { status: 'success'; callId: string; output: string }
  | { status: 'error';   callId: string; error: string; code: string };

// ──── Agent Error ────────────────────────────────────────────

/** Agent 执行层错误 */
export class AgentError extends Error {
  readonly code: string;
  readonly callId?: string;
  readonly timestamp: number;

  constructor(code: string, message: string, callId?: string) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.callId = callId;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AgentError.prototype);
  }
}

// ──── IPC Protocol ───────────────────────────────────────────

/** IPC 请求：渲染进程 → 主进程执行工具 */
export interface AgentIPCRequest {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** IPC 响应：主进程 → 渲染进程 */
export interface AgentIPCResponse {
  callId: string;
  status: 'success' | 'error';
  output?: string;
  error?: string;
  code?: string;
}

// ──── Constants ──────────────────────────────────────────────

/** IPC 频道名（全局常量，避免字符串拼写错误） */
export const IPC_CHANNELS = {
  AGENT_EXECUTE:  'agent:execute',
  AGENT_RESULT:   'agent:result',
} as const;

/** 工具执行超时（毫秒） */
export const TOOL_TIMEOUTS: Record<string, number> = {
  read_file:         5_000,
  write_file:        5_000,
  list_directory:    5_000,
  execute_command:  15_000,
  open_file:        10_000,
  create_directory:  5_000,
  capture_screen:   10_000,
};
