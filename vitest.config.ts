import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    // 运行环境
    environment: 'node',

    // 测试文件匹配
    include: ['tests/**/*.test.ts'],

    // 超时（工具执行可能触发真实超时）
    testTimeout: 15000,

    // 每个测试文件独立作用域
    pool: 'forks',

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      include: ['src/agent/**/*.ts'],
      exclude: ['src/agent/index.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },

    // 全局设置
    globals: false,
  },

  resolve: {
    alias: {
      '@agent': path.resolve(__dirname, 'src/agent'),
    },
  },
});
