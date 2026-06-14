/**
 * schema.ts 单元测试
 *
 * 验证 Agent 工具 Schema 的完整性和正确性。
 */
import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS, getToolByName } from '../../src/agent/schema';

// ──── AGENT_TOOLS 结构 ─────────────────────────────────────

describe('AGENT_TOOLS', () => {
  it('应包含正好 6 个工具', () => {
    expect(AGENT_TOOLS).toHaveLength(6);
  });

  it('每个工具应为 type: function', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.type).toBe('function');
    }
  });

  it('每个工具应有 name', () => {
    const names = AGENT_TOOLS.map(t => t.function.name);
    for (const name of names) {
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    }
  });

  it('每个工具应有 description', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.description.length).toBeGreaterThan(10);
    }
  });

  it('每个工具应有 parameters (JSON Schema object)', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toBeDefined();
    }
  });

  it('工具名不重复', () => {
    const names = AGENT_TOOLS.map(t => t.function.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ──── 单个工具 Schema 校验 ─────────────────────────────────

describe('read_file schema', () => {
  const tool = getToolByName('read_file')!;

  it('应存在', () => { expect(tool).toBeDefined(); });

  it('required 应包含 path', () => {
    expect(tool.function.parameters.required).toContain('path');
  });

  it('应有 offset 和 limit 可选属性', () => {
    const props = tool.function.parameters.properties as Record<string, unknown>;
    expect(props.offset).toBeDefined();
    expect(props.limit).toBeDefined();
  });
});

describe('write_file schema', () => {
  const tool = getToolByName('write_file')!;

  it('required 应包含 path 和 content', () => {
    const req = tool.function.parameters.required as string[];
    expect(req).toContain('path');
    expect(req).toContain('content');
  });
});

describe('list_directory schema', () => {
  const tool = getToolByName('list_directory')!;

  it('required 应为空数组（所有参数可选）', () => {
    const req = tool.function.parameters.required;
    expect(req).toHaveLength(0);
  });
});

describe('execute_command schema', () => {
  const tool = getToolByName('execute_command')!;

  it('required 应包含 command', () => {
    expect(tool.function.parameters.required).toContain('command');
  });
});

describe('open_file schema', () => {
  const tool = getToolByName('open_file')!;

  it('required 应包含 path', () => {
    expect(tool.function.parameters.required).toContain('path');
  });
});

describe('capture_screen schema', () => {
  const tool = getToolByName('capture_screen')!;

  it('应不需要任何参数', () => {
    expect(tool.function.parameters.required).toHaveLength(0);
    const props = tool.function.parameters.properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(0);
  });
});

// ──── getToolByName ────────────────────────────────────────

describe('getToolByName', () => {
  it('应返回已存在的工具', () => {
    const tool = getToolByName('read_file');
    expect(tool).toBeDefined();
    expect(tool!.function.name).toBe('read_file');
  });

  it('不存在的工具应返回 undefined', () => {
    expect(getToolByName('nuclear_launch')).toBeUndefined();
  });

  it('应大小写敏感', () => {
    expect(getToolByName('Read_File')).toBeUndefined();
    expect(getToolByName('READ_FILE')).toBeUndefined();
  });
});
