# PixelCat — AI 桌面宠物

> 一只住在桌面上的 AI 精灵，能看到你、听到你、帮你操作文件和命令。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Electron 28 | 透明无边框窗口 + alwaysOnTop |
| 主进程 | TypeScript 5.3 | 严格模式，类型安全 |
| 渲染进程 | 原生 JS + CSS | 零框架依赖 |
| AI 模型 | Qwen-VL-Max (阿里百炼) | 多模态视觉+语言，Function Calling |
| 语音识别 | Web Speech API | 浏览器内置，免费 |
| 语音合成 | Web Speech Synthesis | 浏览器内置，免费 |
| 画像存储 | JSON 文件 | 零外部依赖，防断电原子写入 |
| 测试 | Vitest | TS 原生支持 |

## 原创功能

- **状态机驱动动画系统** — 7 状态 FSM（IDLE/LISTENING/THINKING/SPEAKING/EXECUTING/ERROR/SLEEPING），状态转换驱动精灵图切换和 CSS 动画
- **统一错误体系** — AppError 类 + 18 种预定义错误码，分层（AI/MEDIA/AGENT/CONFIG），可恢复标记
- **结构化日志系统** — JSON 单行输出，4 级过滤（DEBUG/INFO/WARN/ERROR），模块级 logger
- **安全 Electron 配置** — contextIsolation + sandbox + nodeIntegration:false + contextBridge 白名单 API
- **JS 窗口拖拽** — IPC 通知主进程移动，点击/拖拽区分（< 2px 判定为点击）
- **精灵图角色渲染** — AI 生成的 PNG 精灵（透明背景），CSS 呼吸浮动动画

## 第三方依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| electron | ^28.0.0 | 桌面应用框架 |
| electron-builder | ^24.0.0 | 打包为 exe |
| typescript | ^5.3.0 | 主进程类型安全 |
| vitest | ^1.0.0 | 单元测试 |
| eslint | ^8.56.0 | 代码规范 |
| dotenv | ^16.4.0 | .env 环境变量加载 |

运行时依赖仅 1 个（dotenv），其余均为开发依赖。

## 项目结构

```
pixelcat/
├── src/main/           # Electron 主进程 (TypeScript)
│   ├── index.ts        # 入口：dotenv→config→window→IPC
│   ├── window.ts       # 透明悬浮窗管理
│   ├── ipc.ts          # IPC 处理器注册
│   └── infra/          # 基础设施
│       ├── errors.ts   # AppError + 18 错误码
│       ├── logger.ts   # 结构化 JSON 日志
│       └── config.ts   # 配置校验 + 默认值
├── src/ai/             # AI 服务（Day1 下午）
├── src/agent/          # Agent 工具（Day2 上午）
├── src/profile/        # 用户画像（Day2 上午）
├── preload/            # contextBridge 安全桥接
├── renderer/           # 渲染进程（原生 JS）
│   ├── index.html
│   ├── css/cat.css
│   ├── js/
│   │   ├── app.js               # 入口
│   │   ├── state-machine.js     # 状态机
│   │   └── sprite-animator.js   # 精灵动画
│   └── sprites/        # 角色精灵图 (PNG)
└── tests/              # 单元测试 (Vitest)
```

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 或 QWEN_API_KEY

# 3. 编译 + 运行
npm start
```

## 开发计划

| 阶段 | 内容 | PR |
|------|------|----|
| Day1 上午 | 项目脚手架 + 基础设施 + 精灵图 + 状态机 | PR#1 ✅ |
| Day1 下午 | 摄像头/麦克风 + AI 多模态对话闭环 | PR#2 |
| Day1 晚上 | 错误边界 + Agent 工具 + 沙箱 | PR#3 |
| Day2 上午 | 用户画像存储 + 自动提取 | PR#4 |
| Day2 下午 | 设计文档 + 测试 + 最终打磨 | PR#5 |

## 许可

MIT
