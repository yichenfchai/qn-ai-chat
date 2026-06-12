/**
 * 配置校验模块
 * 
 * 启动时检查必需 env，缺失 → 弹窗提示 → 退出
 * 可选 env 有默认值，不阻塞启动
 */

import { dialog, app } from 'electron';
import { Logger } from './logger';

const logger = new Logger('config');

/** 配置接口 */
export interface AppConfig {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_BASE_URL: string;
  MODEL: string;
  MAX_TOKENS: number;
  TEMPERATURE: number;
  AGENT_TIMEOUT_MS: number;
  LOG_LEVEL: string;
}

const REQUIRED_KEYS = ['DEEPSEEK_API_KEY'] as const;

const DEFAULTS: Record<string, string> = {
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
  MODEL: 'deepseek-v4-pro',
  MAX_TOKENS: '4096',
  TEMPERATURE: '0.7',
  AGENT_TIMEOUT_MS: '30000',
  LOG_LEVEL: 'info',
};

/** 检查并加载配置，失败则弹窗退出 */
export function validateConfig(): AppConfig | null {
  // 检查必需项
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required config', { missing });
    dialog.showErrorBox(
      '配置错误',
      `缺少必要的环境变量:\n${missing.join('\n')}\n\n` +
      '请在项目根目录创建 .env 文件，参考 .env.example 配置后重启。'
    );
    app.quit();
    return null;
  }

  // 填充默认值
  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      logger.info(`Using default: ${key}=${defaultValue}`);
    }
  }

  const config: AppConfig = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY!,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL!,
    MODEL: process.env.MODEL!,
    MAX_TOKENS: parseInt(process.env.MAX_TOKENS!, 10),
    TEMPERATURE: parseFloat(process.env.TEMPERATURE!),
    AGENT_TIMEOUT_MS: parseInt(process.env.AGENT_TIMEOUT_MS!, 10),
    LOG_LEVEL: process.env.LOG_LEVEL!,
  };

  logger.info('Config validated', { model: config.MODEL });
  return config;
}

/** 全局单例配置 */
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('Config not initialized — call validateConfig() first');
  }
  return _config;
}

export function setConfig(config: AppConfig): void {
  _config = config;
}
