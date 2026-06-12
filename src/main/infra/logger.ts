/**
 * 结构化日志系统
 * 
 * 级别：DEBUG < INFO < WARN < ERROR
 * 格式：JSON 单行，方便 grep / 导入日志分析工具
 */

export enum LogLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]:  'INFO',
  [LogLevel.WARN]:  'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

let globalLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export class Logger {
  constructor(private name: string) {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level < globalLevel) return;

    const entry = {
      ts: new Date().toISOString(),
      level: LEVEL_LABELS[level],
      name: this.name,
      message,
      ...(meta || {}),
    };

    const output = JSON.stringify(entry);
    if (level === LogLevel.ERROR) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, msg, meta);
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, msg, meta);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, msg, meta);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, msg, meta);
  }
}

/** 创建模块级 logger */
export function createLogger(name: string): Logger {
  return new Logger(name);
}
