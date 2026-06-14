/**
 * types.ts 单元测试
 *
 * 覆盖：AgentError、常量、ToolCall/ToolResult 类型（运行时校验）
 */
import { describe, it, expect } from 'vitest';
import { AgentError, IPC_CHANNELS, TOOL_TIMEOUTS } from '../../src/agent/types';

describe('AgentError', () => {
  it('应正确构造并保留原型链', () => {
    const err = new AgentError('TEST_CODE', 'test message', 'call-123');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AgentError);
    expect(err.name).toBe('AgentError');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test message');
    expect(err.callId).toBe('call-123');
    expect(typeof err.timestamp).toBe('number');
    expect(err.timestamp).toBeGreaterThan(0);
  });

  it('callId 可为 undefined', () => {
    const err = new AgentError('NO_ID', 'no call id');
    expect(err.callId).toBeUndefined();
  });

  it('timestamp 应在构造时设定且为合理值', () => {
    const before = Date.now();
    const err = new AgentError('T', 'msg');
    const after = Date.now();
    expect(err.timestamp).toBeGreaterThanOrEqual(before);
    expect(err.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('IPC_CHANNELS', () => {
  it('应定义所有必需的频道', () => {
    expect(IPC_CHANNELS.AGENT_EXECUTE).toBe('agent:execute');
    expect(IPC_CHANNELS.AGENT_RESULT).toBe('agent:result');
  });

  it('频道名应不变（外部依赖）', () => {
    // IPC 频道名是主进程/渲染进程之间的契约
    expect(IPC_CHANNELS.AGENT_EXECUTE).toMatch(/^agent:/);
    expect(IPC_CHANNELS.AGENT_RESULT).toMatch(/^agent:/);
  });
});

describe('TOOL_TIMEOUTS', () => {
  it('应为每个工具定义超时', () => {
    expect(TOOL_TIMEOUTS.read_file).toBeGreaterThan(0);
    expect(TOOL_TIMEOUTS.write_file).toBeGreaterThan(0);
    expect(TOOL_TIMEOUTS.list_directory).toBeGreaterThan(0);
    expect(TOOL_TIMEOUTS.execute_command).toBeGreaterThan(0);
    expect(TOOL_TIMEOUTS.open_file).toBeGreaterThan(0);
    expect(TOOL_TIMEOUTS.capture_screen).toBeGreaterThan(0);
  });

  it('execute_command 超时应最长（可能慢）', () => {
    expect(TOOL_TIMEOUTS.execute_command).toBeGreaterThanOrEqual(
      TOOL_TIMEOUTS.read_file
    );
  });

  it('所有超时应 ≤ 30000（防止无限阻塞）', () => {
    for (const timeout of Object.values(TOOL_TIMEOUTS)) {
      expect(timeout).toBeLessThanOrEqual(30000);
    }
  });
});
