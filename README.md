# PixelCat — AI 桌面宠物

> 一只住在桌面上的 AI 精灵猫，能看到你、听到你、帮你操作文件和命令。

## Demo 视频

> 📺 [[Demo 视频链接]  https://www.bilibili.com/video/BV1CGJN6MEtD/

---

## 功能概览

| 类别 | 功能 | 说明 |
|------|------|------|
| 交互 | 单击唤醒 | 开启摄像头 + 麦克风 |
| 交互 | 长按说话 | 按住录制语音 + 画面，松开发送 |
| 交互 | 拖拽移动 | 随意拖到桌面任意位置 |
| 交互 | 双击打字 | 输入文字命令，AI 回复 |
| 交互 | 失焦休眠 | 点桌面其他位置自动关闭摄像头 |
| 交互 | 右键菜单 | 设置 API Key / 关闭应用 |
| AI | 多模态对话 | 文字 + 图片 + 语音输入，流式回复 |
| AI | Function Calling | AI 自主调用工具完成任务 |
| 工具 | read_file | 读取文件内容 |
| 工具 | write_file | 创建/写入文件 |
| 工具 | list_directory | 列出目录 |
| 工具 | create_directory | 新建文件夹 |
| 工具 | execute_command | 执行白名单命令 (dir/ping/ipconfig等) |
| 工具 | open_file | 打开文件/网址 |
| 工具 | capture_screen | 截取屏幕 |
| 旧版 | 打开应用 | 说"打开Chrome"自动启动 |
| 旧版 | 天气查询 | 自动查询 wttr.in |

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Electron 28 | 透明无边框窗口 + alwaysOnTop |
| 主进程 | TypeScript 5.3 | 严格模式，类型安全 |
| 渲染进程 | 原生 JS + CSS | 零框架依赖 |
| AI 模型 | Qwen3.5-Omni-Plus (阿里百炼) | 多模态视觉+语言+音频, Function Calling |
| Agent | 自研循环 | 启发式判断 → Function Calling (max 5轮), 串行工具执行+重试 |
| 沙箱 | 路径白名单 + 命令白名单 | 主进程安全执行 |
| 语音合成 | Web Speech Synthesis | 浏览器内置，免费 |
| 测试 | Vitest | 53 断言 PASS |
| 打包 | electron-builder | Windows 安装包 |

## 第三方依赖

| 依赖 | 版本 | 类型 | 用途 |
|------|------|------|------|
| dotenv | ^16.4.0 | runtime | .env 环境变量加载 |
| electron | ^28.0.0 | dev | 桌面框架 |
| electron-builder | ^24.0.0 | dev | 打包分发 |
| typescript | ^5.3.0 | dev | 类型安全 |
| vitest | ^1.0.0 | dev | 单元测试 |
| eslint | ^8.56.0 | dev | 代码规范 |

运行时仅 1 个依赖（dotenv），其余均为开发期。

## 原创功能

- **Agent Function Calling 循环** — 自研编排层：启发式快速路径 + 完整 Function Calling（最多 5 轮），工具串行执行 + 可恢复错误重试，竞态安全（callId + AbortController）
- **7 个 AI 可调用工具** — read_file/write_file/list_directory/create_directory/execute_command/open_file/capture_screen，通过 IPC 桥接主进程执行
- **安全沙箱** — 路径白名单（仅用户目录/桌面/文档等）+ 命令白名单（仅只读命令）+ 禁止 token（rm/format/shutdown 等），三重校验
- **三态交互区分** — 单击（<400ms, <2px）唤醒 / 长按（≥400ms）录制 / 拖拽（>2px）移动，纯 DOM 事件实现零依赖
- **IPC 工具桥接** — preload contextBridge 白名单 API，invoke/handle 模式，超时保护
- **状态指示灯** — 待机绿 / 唤醒橙 / 录制红脉冲，CSS 动画
- **窗口安全锁定** — min=max 尺寸 + resize 事件守卫 + 移动后校验，防止意外变形

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/yichenfchai/qn-ai-chat.git
cd qn-ai-chat

# 2. 安装依赖
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入百炼 API Key

# 4. 编译 + 启动
npm run build
npx electron .

# 或双击 start.bat
```

## 运行测试

```bash
npm test          # 53 断言 PASS
npm run test:watch  # 监视模式
```

## 项目结构

```
qn-ai-chat/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts    # 入口
│   │   ├── window.ts   # 透明悬浮窗
│   │   ├── ipc.ts      # IPC 处理器
│   │   └── infra/      # 日志/配置/错误
│   └── agent/          # Agent 工具系统
│       ├── schema.ts   # 7个工具定义
│       ├── executor.ts # 工具执行器
│       ├── sandbox.ts  # 安全沙箱
│       └── types.ts    # 类型定义
├── renderer/
│   ├── index.html      # 渲染页面
│   └── js/
│       ├── app.js      # 交互入口 (wiring)
│       ├── state.js    # 状态机
│       └── core/
│           ├── agent.js    # Agent 循环
│           ├── api.js      # AI API 客户端
│           ├── media.js    # 摄像头+麦克风
│           ├── tts.js      # 语音合成
│           ├── tool.js     # 应用启动
│           └── weather-agent.js  # 天气查询
├── preload/            # contextBridge 白名单
├── tests/              # Vitest 单元测试
├── ARCHITECTURE.md     # 架构文档
├── DESIGN.md           # 设计文档（用户故事+成本控制）
└── start.bat           # 一键启动
```

## 成本控制

单用户日均 ~20 次对话，月成本 < ¥2。详见 [DESIGN.md](DESIGN.md)。

- 图像降分辨率 (640×480 → 320×240)，节省 60%+ token
- 启发式快速路径：简单对话不触发 Agent 循环
- Agent 循环最多 5 轮，防止死循环
- 历史裁剪：保留最近 10 条，仅存文本不含图片/音频
- 输出截断 8000 字符，防止大文件撑爆 context
- 15 分钟无操作自动休眠，关闭摄像头
- 本地 TTS（Web Speech API），零 API 调用

## PR 历史

| PR | 标题 | 状态 |
|----|------|------|
| #1 | 项目基础设施 + Electron 安全窗 + 透明背景精灵猫 | merged |
| #2 | 多模态视觉语音交互 + 流式对话 | merged |
| #3 | 鼠标交互模型 + 相机预开 + 排队模式 | merged |
| #4 | Agent Function Calling 核心循环 + 工具定义 | merged |
| #5 | weather-agent + transparent yxcat sprite | merged |
| #6 | 工具执行器 + 安全沙箱 + create_directory | merged |
| #7 | IPC 工具执行桥接 + 设置持久化 | merged |
| #8 | UI 改进 — 气泡/输入框/关闭按钮/窗口锁定 | merged |
| #9 | App 接线 + 补齐旧版 + 设计文档 + 测试 | open |

## 许可

MIT
