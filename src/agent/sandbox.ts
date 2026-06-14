/**
 * 安全沙箱 — 路径白名单 + 命令白名单
 *
 * 所有工具执行前必须通过此模块的校验。
 * 设计：纯函数、无依赖、易于测试。
 */

import * as path from 'path';
import * as os from 'os';

// ──── Path Sandbox ───────────────────────────────────────────

/** 允许读写的目录白名单 */
const READABLE_ROOTS: string[] = [
  os.homedir(),
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Pictures'),
  path.join(os.homedir(), 'Videos'),
  path.join(os.homedir(), 'Music'),
];

/** 只读白名单（系统目录，可以读但不能写） */
const READONLY_ROOTS: string[] = [];

/** 禁止写入的文件名模式（关键系统文件，跨平台路径分隔符） */
const FORBIDDEN_WRITE_PATTERNS = [
  /\.env$/i,
  /\.gitconfig$/i,
  /\.ssh[\/\\]/i,
  /[\/\\]Windows[\/\\]/i,
  /[\/\\]System32[\/\\]/i,
  /[\/\\]Program Files[\/\\]/i,
  /[\/\\]etc[\/\\]/i,
  /\.bashrc$/i,
  /\.zshrc$/i,
  /\.profile$/i,
];

// ──── Command Sandbox ────────────────────────────────────────

/** 命令白名单 (Windows) — 精确匹配可执行文件名 */
const WINDOWS_WHITELIST = new Set([
  'dir', 'type', 'echo', 'cd', 'date', 'time', 'ver',
  'whoami', 'hostname', 'ipconfig', 'ping', 'tracert', 'nslookup',
  'netstat', 'tasklist', 'systeminfo', 'where',
  'find', 'findstr', 'sort', 'more',
  'tree', 'set', 'mkdir', 'md',
]);

/** 命令白名单 (macOS/Linux) */
const UNIX_WHITELIST = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'echo', 'pwd', 'date',
  'whoami', 'hostname', 'uname', 'ifconfig', 'ip', 'ping',
  'netstat', 'ps', 'top', 'df', 'du', 'free',
  'grep', 'find', 'sort', 'uniq', 'cut', 'tr',
  'tree', 'env', 'printenv', 'which',
]);

/** 禁止的命令子串（即使命令本身在白名单里，参数包含这些也拒绝） */
const FORBIDDEN_CMD_TOKENS = [
  'rm ', 'rmdir', 'del ', 'format',
  'shutdown', 'reboot', 'halt',
  'chmod 777', 'chown',
  '> /dev/', '>/dev/', 'dd if=',
  'mkfs', 'fdisk',
  ':(){ :|:& };:',  // fork bomb
];

// ──── Resolution ─────────────────────────────────────────────

/** 将路径解析为绝对路径 */
export function resolvePath(inputPath: string, cwd?: string): string {
  if (!path.isAbsolute(inputPath)) {
    return path.resolve(cwd || os.homedir(), inputPath);
  }
  return path.resolve(inputPath);
}

/** 检查路径是否在允许的目录下 */
export function isPathAllowed(
  absPath: string,
  allowWrite: boolean
): { allowed: boolean; reason?: string } {
  const normalized = path.normalize(absPath).toLowerCase();

  // 写操作额外检查
  if (allowWrite) {
    for (const pattern of FORBIDDEN_WRITE_PATTERNS) {
      if (pattern.test(normalized)) {
        return { allowed: false, reason: `禁止写入路径: ${absPath}` };
      }
    }
  }

  // 检查读写白名单
  for (const root of READABLE_ROOTS) {
    const normalizedRoot = path.normalize(root).toLowerCase();
    if (normalized.startsWith(normalizedRoot + path.sep) || normalized === normalizedRoot) {
      return { allowed: true };
    }
  }

  // 检查只读白名单
  if (!allowWrite) {
    for (const root of READONLY_ROOTS) {
      const normalizedRoot = path.normalize(root).toLowerCase();
      if (normalized.startsWith(normalizedRoot + path.sep) || normalized === normalizedRoot) {
        return { allowed: true };
      }
    }
  }

  return { allowed: false, reason: `路径不在允许范围内: ${absPath}` };
}

// ──── Command Validation ─────────────────────────────────────

/** 验证命令是否安全 */
export function validateCommand(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();
  if (!trimmed) {
    return { allowed: false, reason: '空命令' };
  }

  // 检查禁止的 token
  for (const token of FORBIDDEN_CMD_TOKENS) {
    if (trimmed.toLowerCase().includes(token.toLowerCase())) {
      return { allowed: false, reason: `危险操作: ${token}` };
    }
  }

  // 提取命令名（第一个词）
  const cmdName = trimmed.split(/\s+/)[0].toLowerCase();

  const whitelist = process.platform === 'win32' ? WINDOWS_WHITELIST : UNIX_WHITELIST;

  if (!whitelist.has(cmdName)) {
    return { allowed: false, reason: `命令不在白名单: ${cmdName}` };
  }

  return { allowed: true };
}

/** 生成安全的 shell 命令（跨平台） */
export function wrapCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return { shell: 'cmd.exe', args: ['/c', command] };
  }
  return { shell: '/bin/sh', args: ['-c', command] };
}
