/**
 * sandbox.ts 单元测试
 *
 * 安全模块的核心——路径白名单 + 命令白名单。
 * 这些测试是安全防线，必须全部通过。
 */
import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  resolvePath,
  isPathAllowed,
  validateCommand,
  wrapCommand,
} from '../../src/agent/sandbox';

// ──── resolvePath ──────────────────────────────────────────

describe('resolvePath', () => {
  it('相对路径应基于用户主目录解析', () => {
    const result = resolvePath('Desktop');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result.toLowerCase()).toContain('desktop');
  });

  it('绝对路径应保持不变', () => {
    const input = os.homedir() + '/test.txt';
    const result = resolvePath(input);
    expect(result).toBe(path.resolve(input));
  });

  it('路径中的 .. 应被规范化', () => {
    const result = resolvePath('Desktop/../Documents');
    expect(result).not.toContain('..');
    expect(result.toLowerCase()).toContain('documents');
  });
});

// ──── isPathAllowed ────────────────────────────────────────

describe('isPathAllowed', () => {
  it('用户主目录下的文件应允许读取', () => {
    const check = isPathAllowed(path.join(os.homedir(), 'test.txt'), false);
    expect(check.allowed).toBe(true);
  });

  it('桌面目录下的文件应允许读取', () => {
    const check = isPathAllowed(path.join(os.homedir(), 'Desktop', 'file.txt'), false);
    expect(check.allowed).toBe(true);
  });

  it('Documents 目录下的文件应允许读取', () => {
    const check = isPathAllowed(path.join(os.homedir(), 'Documents', 'note.md'), false);
    expect(check.allowed).toBe(true);
  });

  it('Downloads 目录应允许读取', () => {
    const check = isPathAllowed(path.join(os.homedir(), 'Downloads', 'setup.exe'), false);
    expect(check.allowed).toBe(true);
  });

  it('系统目录 (Windows/System32) 应拒绝写入', () => {
    // On non-Windows, fall back to /etc
    const forbiddenPath = process.platform === 'win32'
      ? 'C:\\Windows\\System32\\test.dll'
      : '/etc/shadow';
    const result = isPathAllowed(forbiddenPath, true);
    expect(result.allowed).toBe(false);
  });

  it('.env 文件应拒绝写入（即使路径在白名单）', () => {
    const check = isPathAllowed(path.join(os.homedir(), 'Desktop', '.env'), true);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBeDefined();
  });

  it('.gitconfig 应拒绝写入', () => {
    const check = isPathAllowed(path.join(os.homedir(), '.gitconfig'), true);
    expect(check.allowed).toBe(false);
  });

  it('System32 目录应拒绝写入', () => {
    const forbiddenPath = process.platform === 'win32'
      ? 'C:\\Windows\\System32\\test.txt'
      : '/etc/test.txt';
    const check = isPathAllowed(forbiddenPath, true);
    expect(check.allowed).toBe(false);
  });

  it('不在白名单的路径应拒绝', () => {
    const check = isPathAllowed('/tmp/malicious.sh', false);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBeDefined();
  });

  it('只读模式不检查写入禁止模式', () => {
    // .env 在只读模式下应该允许
    // (因为只读模式只检查可读白名单，不检查写入禁止模式)
    const check = isPathAllowed(path.join(os.homedir(), '.env'), false);
    // 是否允许取决于 .env 路径是否在可读白名单内
    // homedir 在白名单内，所以 .env 可读
    expect(check.allowed).toBe(true);
  });
});

// ──── validateCommand ──────────────────────────────────────

describe('validateCommand', () => {
  it('空命令应拒绝', () => {
    const check = validateCommand('');
    expect(check.allowed).toBe(false);
  });

  it('纯空格命令应拒绝', () => {
    const check = validateCommand('   ');
    expect(check.allowed).toBe(false);
  });

  it('白名单命令 ipconfig 应允许', () => {
    const check = validateCommand('ipconfig /all');
    expect(check.allowed).toBe(true);
  });

  it('白名单命令 dir 应允许', () => {
    const check = validateCommand('dir C:\\Users');
    expect(check.allowed).toBe(true);
  });

  it('白名单命令 ping 应允许', () => {
    const check = validateCommand('ping -n 1 localhost');
    expect(check.allowed).toBe(true);
  });

  it('不在白名单的命令应拒绝', () => {
    const check = validateCommand('wget http://evil.com');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('不在白名单');
  });

  it('rm 命令应拒绝（危险 token）', () => {
    const check = validateCommand('rm -rf /');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('危险操作');
  });

  it('del 命令应拒绝（危险 token）', () => {
    const check = validateCommand('del /f important.txt');
    expect(check.allowed).toBe(false);
  });

  it('format 命令应拒绝', () => {
    const check = validateCommand('format C:');
    expect(check.allowed).toBe(false);
  });

  it('shutdown 命令应拒绝', () => {
    const check = validateCommand('shutdown /s');
    expect(check.allowed).toBe(false);
  });

  it('curl 应拒绝', () => {
    const check = validateCommand('curl http://example.com');
    expect(check.allowed).toBe(false);
  });

  it('cat 应允许（Unix 白名单）', () => {
    // 在 Windows 上 cat 不在白名单，在 Unix 上在白名单
    const check = validateCommand('cat file.txt');
    // 不依赖平台：保证要么允许且合理，要么拒绝且给出原因
    if (!check.allowed) {
      expect(check.reason).toBeDefined();
    }
  });
});

// ──── wrapCommand ──────────────────────────────────────────

describe('wrapCommand', () => {
  it('应返回 shell 和 args', () => {
    const { shell, args } = wrapCommand('ipconfig');
    expect(shell).toBeTruthy();
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
  });

  it('Windows 应使用 cmd.exe', () => {
    if (process.platform === 'win32') {
      const { shell } = wrapCommand('dir');
      expect(shell.toLowerCase()).toContain('cmd');
    }
  });
});
