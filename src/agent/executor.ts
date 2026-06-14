/**
 * 工具执行器 — 无状态、纯函数
 *
 * 每个工具函数签名统一：
 *   (args, callId) => Promise<ToolResult>
 *
 * 安全策略：
 *   1. 所有文件操作先过 sandbox 校验
 *   2. execute_command 白名单 + 禁止 token 双重检查
 *   3. 每个工具独立 try/catch，一个工具崩不影响其他
 *   4. 超时由调用方（IPC handler）负责，执行器不关心
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { ToolCall, ToolResult, AgentError } from './types';
import { resolvePath, isPathAllowed, validateCommand, wrapCommand } from './sandbox';

// ──── Helpers ────────────────────────────────────────────────

/** 创建成功结果 */
function ok(callId: string, output: string): ToolResult {
  return { status: 'success', callId, output };
}

/** 创建错误结果 */
function fail(callId: string, code: string, error: string): ToolResult {
  return { status: 'error', callId, code, error };
}

/** 安全截断输出（防止 AI context 爆炸） */
function truncate(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 100) + `\n... [截断，共 ${text.length} 字符]`;
}

// ──── Tool Implementations ───────────────────────────────────

/**
 * read_file — 读取文件内容
 * 参数: { path: string, offset?: number, limit?: number }
 */
async function toolReadFile(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const filePath = (args.path as string)?.trim();
  if (!filePath) return fail(callId, 'INVALID_ARGS', '缺少 path 参数');

  const absPath = resolvePath(filePath);
  const check = isPathAllowed(absPath, false);
  if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);

  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return fail(callId, 'NOT_A_FILE', '路径不是文件');

    const offset = Math.max(1, (args.offset as number) || 1);
    const limit = Math.min(1000, (args.limit as number) || 500);
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const slice = lines.slice(offset - 1, offset - 1 + limit);

    let out = slice.join('\n');
    if (slice.length < lines.length) {
      out += `\n[第 ${offset}-${offset + slice.length - 1} 行，共 ${lines.length} 行]`;
    }
    return ok(callId, truncate(out));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return fail(callId, 'FILE_NOT_FOUND', `文件不存在: ${filePath}`);
    }
    return fail(callId, 'READ_ERROR', `读取失败: ${(e as Error).message}`);
  }
}

/**
 * write_file — 写入文件（只允许在白名单目录）
 * 参数: { path: string, content: string }
 */
async function toolWriteFile(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const filePath = (args.path as string)?.trim();
  const content = (args.content as string);
  if (!filePath) return fail(callId, 'INVALID_ARGS', '缺少 path 参数');
  if (content === undefined) return fail(callId, 'INVALID_ARGS', '缺少 content 参数');

  const absPath = resolvePath(filePath);
  const check = isPathAllowed(absPath, true);
  if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);

  try {
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, content, 'utf-8');
    const size = Buffer.byteLength(content, 'utf-8');
    return ok(callId, `已写入 ${absPath} (${size} 字节)`);
  } catch (e) {
    return fail(callId, 'WRITE_ERROR', `写入失败: ${(e as Error).message}`);
  }
}

/**
 * list_directory — 列出目录内容
 * 参数: { path?: string, showHidden?: boolean }
 */
async function toolListDir(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const dirPath = (args.path as string)?.trim() || os.homedir();
  const showHidden = (args.showHidden as boolean) || false;

  const absPath = resolvePath(dirPath);
  const check = isPathAllowed(absPath, false);
  if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);

  try {
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    const lines: string[] = [];
    for (const e of entries) {
      if (!showHidden && e.name.startsWith('.')) continue;
      const type = e.isDirectory() ? '[DIR]' : e.isSymbolicLink() ? '[LNK]' : '[FILE]';
      lines.push(`${type} ${e.name}`);
    }
    return ok(callId, truncate(`${absPath}\n${lines.join('\n') || '(空目录)'}`));
  } catch (e) {
    return fail(callId, 'LIST_ERROR', `列目录失败: ${(e as Error).message}`);
  }
}

/**
 * execute_command — 执行只读命令（白名单限制）
 * 参数: { command: string, timeout?: number }
 */
async function toolExecuteCmd(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const command = (args.command as string)?.trim();
  if (!command) return fail(callId, 'INVALID_ARGS', '缺少 command 参数');
  const timeout = Math.min(15000, (args.timeout as number) || 15000);

  const check = validateCommand(command);
  if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);

  return new Promise((resolve) => {
    const { shell, args: shellArgs } = wrapCommand(command);
    const child = execFile(shell, shellArgs, {
      timeout,
      maxBuffer: 512 * 1024,
      windowsHide: true,
      cwd: os.homedir(),
    }, (error, stdout, stderr) => {
      if (error) {
        // 超时或非零退出
        const msg = error.killed
          ? '命令执行超时'
          : `退出码 ${error.code}: ${(stderr || error.message).trim()}`;
        resolve(fail(callId, 'CMD_FAILED', truncate(msg, 2000)));
        return;
      }
      const out = stdout.trim() || stderr.trim() || '(无输出)';
      resolve(ok(callId, truncate(out)));
    });
  });
}

/**
 * open_file — 用系统默认程序打开文件/URL
 * 参数: { path: string }
 */
async function toolOpenFile(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const target = (args.path as string)?.trim();
  if (!target) return fail(callId, 'INVALID_ARGS', '缺少 path 参数');

  // URL 不需要路径校验
  const isUrl = /^https?:\/\//i.test(target);
  if (!isUrl) {
    const absPath = resolvePath(target);
    const check = isPathAllowed(absPath, false);
    if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);
  }

  try {
    // 使用 Electron 的 shell module（由 IPC 调用方注入）
    // 这里用动态 require 避免在主进程入口之外引入 electron
    const { shell } = require('electron');
    const resolved = isUrl ? target : resolvePath(target);

    if (isUrl) {
      await shell.openExternal(resolved);
    } else {
      await shell.openPath(resolved);
    }

    return ok(callId, `已打开: ${target}`);
  } catch (e) {
    return fail(callId, 'OPEN_ERROR', `打开失败: ${(e as Error).message}`);
  }
}


/**
 * create_directory — 创建目录
 * 参数: { path: string }
 */
async function toolCreateDir(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  const dirPath = (args.path as string)?.trim();
  if (!dirPath) return fail(callId, 'INVALID_ARGS', '缺少 path 参数');

  const absPath = resolvePath(dirPath);
  const check = isPathAllowed(absPath, true);
  if (!check.allowed) return fail(callId, 'SANDBOX_DENIED', check.reason!);

  try {
    fs.mkdirSync(absPath, { recursive: true });
    return ok(callId, `已创建目录: ${absPath}`);
  } catch (e) {
    return fail(callId, 'CREATE_ERROR', `创建失败: ${(e as Error).message}`);
  }
}

/**
 * capture_screen — 返回提示（实际截图由 renderer 完成）
 * 在主进程中无法直接截图，返回一个标记让 renderer 补充。
 */
async function toolCaptureScreen(args: Record<string, unknown>, callId: string): Promise<ToolResult> {
  // 此工具的执行在 renderer 侧完成（用 html2canvas 或 MediaDevices）
  // 主进程这边返回一个占位，由 agent.js 识别并补全
  return ok(callId, '[SCREENSHOT_PENDING]');
}

// ──── Dispatcher ─────────────────────────────────────────────

/** 工具注册表：工具名 → 执行函数 */
const TOOL_REGISTRY: Record<string, (args: Record<string, unknown>, callId: string) => Promise<ToolResult>> = {
  read_file:        toolReadFile,
  write_file:       toolWriteFile,
  list_directory:   toolListDir,
  execute_command:  toolExecuteCmd,
  open_file:        toolOpenFile,
  create_directory: toolCreateDir,
  capture_screen:   toolCaptureScreen,
};

/** 执行单个工具调用 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const fn = TOOL_REGISTRY[call.name];
  if (!fn) {
    return fail(call.callId, 'UNKNOWN_TOOL', `未知工具: ${call.name}`);
  }

  try {
    return await fn(call.arguments, call.callId);
  } catch (e) {
    return fail(call.callId, 'EXECUTION_ERROR', `工具执行异常: ${(e as Error).message}`);
  }
}

/** 检查工具是否存在 */
export function hasTool(name: string): boolean {
  return name in TOOL_REGISTRY;
}

/** 返回所有已注册工具的名称 */
export function listTools(): string[] {
  return Object.keys(TOOL_REGISTRY);
}
