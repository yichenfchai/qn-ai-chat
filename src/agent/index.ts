/**
 * Agent 模块 — 公共 API
 *
 * 使用方式:
 *   主进程: import { executeTool, AGENT_TOOLS, ... } from '../agent';
 *   测试:   import { executeTool, ... } from '../../src/agent';
 */

// 类型
export type { ToolCall, ToolResult, ToolDefinition, AgentIPCRequest, AgentIPCResponse } from './types';
export { AgentError, IPC_CHANNELS, TOOL_TIMEOUTS } from './types';

// 沙箱（供外部做预检查）
export { resolvePath, isPathAllowed, validateCommand } from './sandbox';

// 执行器
export { executeTool, hasTool, listTools } from './executor';

// Schema（给渲染进程用，需编译为 JS）
export { AGENT_TOOLS, getToolByName } from './schema';
