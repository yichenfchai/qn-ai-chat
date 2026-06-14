/**
 * executor.ts 单元测试
 *
 * 覆盖 6 个工具的全部路径：正常执行、错误处理、边界条件。
 * 文件系统操作使用 os.tmpdir() 确保隔离。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { executeTool, hasTool, listTools } from '../../src/agent/executor';
import type { ToolCall } from '../../src/agent/types';

// ──── Test Helpers ─────────────────────────────────────────

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelcat-test-'));
});

afterEach(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
});

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    callId: 'test-' + name + '-' + Date.now(),
    name,
    arguments: args,
  };
}

// ──── Dispatcher ───────────────────────────────────────────

describe('executeTool — dispatch', () => {
  it('should return success or non-UNKNOWN_TOOL error for known tool', async () => {
    const result = await executeTool(makeCall('list_directory', {}));
    if (result.status === 'error') {
      expect(result.code).not.toBe('UNKNOWN_TOOL');
    } else {
      expect(result.status).toBe('success');
    }
  });

  it('should return UNKNOWN_TOOL for unknown tool', async () => {
    const result = await executeTool(makeCall('nonexistent_tool', {}));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('UNKNOWN_TOOL');
    }
  });
});

describe('hasTool', () => {
  it('should return true for all registered tools', () => {
    expect(hasTool('read_file')).toBe(true);
    expect(hasTool('write_file')).toBe(true);
    expect(hasTool('list_directory')).toBe(true);
    expect(hasTool('execute_command')).toBe(true);
    expect(hasTool('open_file')).toBe(true);
    expect(hasTool('capture_screen')).toBe(true);
  });

  it('should return false for unknown tools', () => {
    expect(hasTool('delete_everything')).toBe(false);
    expect(hasTool('')).toBe(false);
  });
});

describe('listTools', () => {
  it('should return all 6 tools', () => {
    const tools = listTools();
    expect(tools).toHaveLength(6);
    expect(tools).toContain('read_file');
    expect(tools).toContain('write_file');
    expect(tools).toContain('list_directory');
    expect(tools).toContain('execute_command');
    expect(tools).toContain('open_file');
    expect(tools).toContain('capture_screen');
  });
});

// ──── read_file ────────────────────────────────────────────

describe('read_file', () => {
  it('should read file content', async () => {
    const filePath = path.join(testDir, 'hello.txt');
    fs.writeFileSync(filePath, 'Hello World\nLine 2\nLine 3');

    const result = await executeTool(makeCall('read_file', { path: filePath }));
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toContain('Hello World');
    }
  });

  it('should return FILE_NOT_FOUND for missing file', async () => {
    const result = await executeTool(makeCall('read_file', {
      path: path.join(testDir, 'does-not-exist.txt'),
    }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('FILE_NOT_FOUND');
    }
  });

  it('should return INVALID_ARGS when path is missing', async () => {
    const result = await executeTool(makeCall('read_file', {}));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_ARGS');
    }
  });

  it('should respect offset and limit', async () => {
    const filePath = path.join(testDir, 'numbered.txt');
    const lines = Array.from({ length: 20 }, (_, i) => 'Line ' + (i + 1));
    fs.writeFileSync(filePath, lines.join('\n'));

    const result = await executeTool(makeCall('read_file', {
      path: filePath,
      offset: 5,
      limit: 3,
    }));
    expect(result.status).toBe('success');
    if (result.status === 'success' && result.output) {
      expect(result.output).toContain('Line 5');
      expect(result.output).toContain('Line 7');
      expect(result.output).not.toContain('Line 4');
    }
  });
});

// ──── write_file ───────────────────────────────────────────

describe('write_file', () => {
  it('should create and write to new file', async () => {
    const filePath = path.join(testDir, 'output.txt');
    const result = await executeTool(makeCall('write_file', {
      path: filePath,
      content: 'Hello from test',
    }));
    expect(result.status).toBe('success');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('Hello from test');
  });

  it('should overwrite existing file', async () => {
    const filePath = path.join(testDir, 'overwrite.txt');
    fs.writeFileSync(filePath, 'old content');
    await executeTool(makeCall('write_file', { path: filePath, content: 'new' }));
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new');
  });

  it('should reject missing path', async () => {
    const result = await executeTool(makeCall('write_file', { content: 'test' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_ARGS');
    }
  });

  it('should reject missing content', async () => {
    const result = await executeTool(makeCall('write_file', { path: testDir + '/f.txt' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_ARGS');
    }
  });

  it('should reject forbidden paths', async () => {
    const forbiddenPath = process.platform === 'win32'
      ? 'C:\\Windows\\System32\\test_agent.txt'
      : '/etc/test_agent.txt';
    const result = await executeTool(makeCall('write_file', {
      path: forbiddenPath,
      content: 'test',
    }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('SANDBOX_DENIED');
    }
  });

  it('should auto-create parent directories', async () => {
    const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
    const result = await executeTool(makeCall('write_file', {
      path: filePath,
      content: 'deep',
    }));
    expect(result.status).toBe('success');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

// ──── list_directory ───────────────────────────────────────

describe('list_directory', () => {
  it('should list files and directories', async () => {
    fs.writeFileSync(path.join(testDir, 'a.txt'), '');
    fs.writeFileSync(path.join(testDir, 'b.txt'), '');
    fs.mkdirSync(path.join(testDir, 'subdir'));

    const result = await executeTool(makeCall('list_directory', { path: testDir }));
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toContain('a.txt');
      expect(result.output).toContain('b.txt');
      expect(result.output).toContain('subdir');
    }
  });

  it('should show message for empty directory', async () => {
    const result = await executeTool(makeCall('list_directory', { path: testDir }));
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toContain('\u7a7a\u76ee\u5f55');
    }
  });

  it('should reject paths outside sandbox', async () => {
    const result = await executeTool(makeCall('list_directory', { path: '/etc' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('SANDBOX_DENIED');
    }
  });
});

// ──── execute_command ──────────────────────────────────────

describe('execute_command', () => {
  it('should reject dangerous commands', async () => {
    const result = await executeTool(makeCall('execute_command', {
      command: 'rm -rf /',
    }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('SANDBOX_DENIED');
    }
  });

  it('should reject empty command', async () => {
    const result = await executeTool(makeCall('execute_command', { command: '' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_ARGS');
    }
  });

  it('should reject non-whitelisted commands', async () => {
    const result = await executeTool(makeCall('execute_command', {
      command: 'curl http://evil.com',
    }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('SANDBOX_DENIED');
    }
  });
});

// ──── open_file ────────────────────────────────────────────

describe('open_file', () => {
  it('should allow URLs through sandbox', async () => {
    const result = await executeTool(makeCall('open_file', {
      path: 'https://github.com',
    }));
    if (result.status === 'error') {
      expect(result.code).not.toBe('SANDBOX_DENIED');
    }
  });

  it('should reject missing path', async () => {
    const result = await executeTool(makeCall('open_file', {}));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_ARGS');
    }
  });
});

// ──── capture_screen ───────────────────────────────────────

describe('capture_screen', () => {
  it('should return SCREENSHOT_PENDING placeholder', async () => {
    const result = await executeTool(makeCall('capture_screen', {}));
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toContain('SCREENSHOT_PENDING');
    }
  });
});

// ──── Edge Cases ───────────────────────────────────────────

describe('executor edge cases', () => {
  it('should truncate very long output', async () => {
    const filePath = path.join(testDir, 'long.txt');
    const longLine = 'x'.repeat(1000);
    const lines = Array.from({ length: 50 }, () => longLine);
    fs.writeFileSync(filePath, lines.join('\n'));

    const result = await executeTool(makeCall('read_file', {
      path: filePath,
      limit: 100,
    }));
    expect(result.status).toBe('success');
    if (result.status === 'success' && result.output) {
      expect(result.output.length).toBeLessThanOrEqual(8200);
    }
  });

  it('should not interfere between parallel calls', async () => {
    const filePath = path.join(testDir, 'parallel.txt');
    fs.writeFileSync(filePath, 'parallel test');

    const [r1, r2, r3] = await Promise.all([
      executeTool(makeCall('read_file', { path: filePath })),
      executeTool(makeCall('list_directory', { path: testDir })),
      executeTool(makeCall('capture_screen', {})),
    ]);

    expect(r1.status).toBe('success');
    expect(r2.status).toBe('success');
    expect(r3.status).toBe('success');
    expect(r1.callId).not.toBe(r2.callId);
    expect(r2.callId).not.toBe(r3.callId);
  });
});
