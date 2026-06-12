/**
 * 统一错误体系 — 所有模块抛出的错误都使用 AppError
 * 
 * 错误码分层：
 *   AI_*     — AI 服务调用层
 *   MEDIA_*  — 摄像头/麦克风媒体层
 *   AGENT_*  — Agent 工具执行层
 *   CONFIG_* — 配置层
 *   IPC_*    — 进程通信层
 *   UNKNOWN  — 兜底
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly recoverable: boolean;
  public readonly timestamp: number;
  public readonly detail?: unknown;

  constructor(
    code: string,
    message: string,
    httpStatus = 500,
    recoverable = false,
    detail?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.recoverable = recoverable;
    this.timestamp = Date.now();
    this.detail = detail;

    // 保持正确的原型链（TS 继承 Error 需要）
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      detail: this.detail,
    };
  }
}

/** 预定义错误码 */
export const ErrorCodes = {
  // AI 层
  AI_TIMEOUT:      { code: 'AI_TIMEOUT',      msg: 'AI 响应超时，请重试',           retry: true  },
  AI_RATE_LIMIT:   { code: 'AI_RATE_LIMIT',   msg: '请求太频繁，稍等一下喵~',         retry: true  },
  AI_INVALID_KEY:  { code: 'AI_INVALID_KEY',  msg: 'API Key 无效，请检查 .env 配置', retry: false },
  AI_MODEL_ERROR:  { code: 'AI_MODEL_ERROR',  msg: '模型服务异常',                  retry: true  },
  AI_EMPTY_RESP:   { code: 'AI_EMPTY_RESP',   msg: 'AI 返回了空内容',              retry: true  },

  // 媒体层
  CAMERA_DENIED:   { code: 'CAMERA_DENIED',   msg: '摄像头权限被拒绝',              retry: false },
  MIC_DENIED:      { code: 'MIC_DENIED',      msg: '麦克风权限被拒绝',              retry: false },
  MEDIA_NOT_FOUND: { code: 'MEDIA_NOT_FOUND', msg: '未找到摄像头或麦克风设备',       retry: false },

  // Agent 层
  AGENT_TIMEOUT:   { code: 'AGENT_TIMEOUT',   msg: '操作超时',                     retry: false },
  AGENT_PERMISSION:{ code: 'AGENT_PERMISSION',msg: '操作需要你的确认',               retry: false },
  AGENT_DANGEROUS: { code: 'AGENT_DANGEROUS', msg: '危险操作已被拦截',              retry: false },
  AGENT_DENIED:    { code: 'AGENT_DENIED',    msg: '用户拒绝了该操作',              retry: false },
  FILE_NOT_FOUND:  { code: 'FILE_NOT_FOUND',  msg: '文件不存在',                    retry: false },

  // 配置层
  CONFIG_MISSING:  { code: 'CONFIG_MISSING',  msg: '缺少必要的配置',                retry: false },

  // 通用
  NETWORK_ERROR:   { code: 'NETWORK_ERROR',   msg: '网络连接失败',                  retry: true  },
  IPC_ERROR:       { code: 'IPC_ERROR',       msg: '进程通信异常',                  retry: false },
  UNKNOWN:         { code: 'UNKNOWN',         msg: '发生了未知错误',                retry: false },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/** 从预定义错误码创建 AppError */
export function makeError(code: ErrorCode, detail?: unknown): AppError {
  const def = ErrorCodes[code];
  return new AppError(def.code, def.msg, 500, def.retry, detail);
}
