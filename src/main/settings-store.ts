/**
 * 设置持久化 — JSON 文件
 */
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './infra/logger';

const logger = createLogger('settings');

export interface UserSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  nlsAppKey: string;
}

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');

const DEFAULTS: UserSettings = {
  apiKey: '',
  model: 'qwen-vl-max',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  nlsAppKey: '',
};

export function loadSettings(): UserSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      logger.info('Settings loaded from file');
      return { ...DEFAULTS, ...data };
    }
  } catch (e: any) {
    logger.warn('Failed to load settings', { error: e.message });
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: UserSettings): void {
  // 原子写入
  const tmp = SETTINGS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, SETTINGS_PATH);
  logger.info('Settings saved');
}

/** 合并 env 和 settings.json，settings.json 优先 */
export function getEffectiveSettings(): UserSettings {
  const fileSettings = loadSettings();
  return {
    apiKey: fileSettings.apiKey || process.env.AI_API_KEY || '',
    model: fileSettings.model || process.env.AI_MODEL || 'qwen-vl-max',
    baseUrl: fileSettings.baseUrl || process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    nlsAppKey: fileSettings.nlsAppKey || process.env.NLS_APP_KEY || '',
  };
}
