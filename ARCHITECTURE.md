# PixelCat 架构决策记录 (ADR)

> 记录关键设计选择及理由，方便面试官和新成员理解项目取舍。

---

## ADR-1：为什么用 Electron 而不是 Tauri

**决策**：原型阶段用 Electron，计划迁移到 Tauri。

**理由**：
- Electron 的 Chromium 渲染引擎直接支持 CSS 动画（精灵图浮动/晃动/缩放/Zzz），零额外工作
- `getUserMedia`、`Web Speech API`、`AudioWorklet` 整个媒体管线浏览器原生支持，不用引入 Rust crate
- 比赛时间紧，先用 Electron 验证核心闭环（按住空格→看/听→AI 回复→朗读），后续 Tauri 迁移有明确对标

**代价**：包体积大（~150MB vs Tauri ~5MB），内存占用高。

---

## ADR-2：AI API 为什么在渲染进程而不在主进程

**决策**：`renderer/js/core/api.js` 直接通过 `fetch` 调用阿里百炼 API。

**理由**：
- 浏览器 `fetch` + `ReadableStream` 天然支持 SSE 流解析
- CSP 已限制 `connect-src` 只允许阿里 API 域名，安全可控
- 如果用主进程发请求，需要 HTTP 库（axios/node-fetch），增加依赖

**特殊处理**：Function Calling 模式下 `streamWithTools()` 需要同时解析 `content` 和 `tool_calls` 两个 SSE 字段——主进程做同样的事不会更简单。

---

## ADR-3：工具执行为什么在主进程

**决策**：Agent 所有的文件/命令操作通过 IPC 委托主进程执行。

**理由**：
- 渲染进程设置了 `sandbox: true`，没有 `fs`/`child_process` 权限——这是 Electron 安全最佳实践
- 主进程可以集中做沙箱校验（`src/agent/sandbox.ts`），避免两份实现
- IPC 延迟（<1ms）对文件操作/命令执行不构成瓶颈

**唯一例外**：`capture_screen` 在渲染进程直接完成（需要 DOM 访问）。

---

## ADR-4：为什么选 Qwen-Omni 而不是 GPT-4o

**决策**：主模型用阿里百炼 `qwen3.5-omni-plus`（兼容 OpenAI 协议）。

**理由**：
- 国内比赛项目，百炼 API 在境内延迟比 OpenAI 低 3-5 倍
- 兼容 OpenAI 协议 → `tools`/`tool_choice`/`stream` 字段完全一致 → 换模型只改 `model` 参数
- 支持 `input_audio`（WAV base64 直接传入），不需要外挂 STT

**后备**：`.env.example` 同时保留了 `DEEPSEEK_API_KEY` 配置——如果百炼限流可以切。

---

## ADR-5：工具失败为什么只重试 1 次

**决策**：可恢复错误（`CMD_FAILED`/`AGENT_TIMEOUT`/`IPC_ERROR`/`EXECUTION_ERROR`）自动重试 **1 次**，不做指数退避。

**理由**：
- 每个工具执行本身有 IPC 超时（5-15s），如果 3 次重试总时长可能到 45s——桌面宠物场景用户等不了
- 失败后 AI 会收到错误消息，可以用自然语言告诉用户"没成功"——比卡住好
- 不可恢复错误（`SANDBOX_DENIED`/`FILE_NOT_FOUND`/`INVALID_ARGS`）重试无意义

---

## ADR-6：Agent TOOLS 为什么从 IPC 拉取

**决策**：渲染进程首次 `run()` 时通过 `agent:getTools` IPC 拉取工具定义，之后缓存。

**理由**：
- 之前 `src/agent/schema.ts` 和 `renderer/js/core/agent.js` 各自硬编码相同定义 → 改一处漏一处
- 渲染进程是裸 JS（无 TS 编译），不能直接 `import` `.ts` 模块
- IPC 拉取方案零构建依赖，运行时保证单源

**后备**：IPC 失败时用 `_fallbackTools()`（与 schema.ts 描述一致但内联），Agent 不会因为 IPC 未就绪而完全不可用。

---

## ADR-7：`_shouldUseTools` 为什么用启发式而不是每次都带 tools

**决策**：先检查用户文本是否含工具触发词，不含则走 `AI.chat()`（纯文本、无 tools）。

**理由**：
- 每条 API 请求带 6 个 tools 的 JSON Schema 约 2KB → 简单对话（"你好""今天天气怎么样"）浪费 token
- 空格键场景（摄像头 + 语音 → "请根据画面和语音回复"）本身就是简单问答，不走 Agent 循环
- 假阴性（用户想用工具但没触发）有 `_replyWantsTools()` 降级安全网
- 假阳性（触发词但实际不需要）只是多了一次 API 调用带 tools，不会崩溃

---

## 安全设计

### 文件操作：双层防御

```
用户输入 path
    ↓
resolvePath()          → 转绝对路径
    ↓
isPathAllowed()
    ├── FORBIDDEN_WRITE_PATTERNS  → 拒绝 .env / .gitconfig / .ssh / Windows / System32
    └── READABLE_ROOTS             → 只允许 桌面/文档/下载/图片/视频/音乐
    ↓
fs.readFileSync / fs.writeFileSync
```

### 命令执行：白名单 + 禁止 token

```
用户输入 command
    ↓
validateCommand()
    ├── FORBIDDEN_CMD_TOKENS  → 拒绝 rm / del / format / shutdown / chmod ...
    └── WHITELIST             → 只允许 dir/ping/ipconfig/ls/cat/echo ...
    ↓
execFile(cmd.exe, ['/c', command], { timeout })
```

---

## 文件结构速查

```
pixelcat/
├── src/
│   ├── agent/           # Agent 工具系统（主进程 TS）
│   │   ├── types.ts     # ToolCall / ToolResult / IPC 协议
│   │   ├── sandbox.ts   # 路径白名单 + 命令白名单
│   │   ├── executor.ts  # 6 个工具的无状态执行器
│   │   ├── schema.ts    # OpenAI Function Calling JSON Schema（单源）
│   │   └── index.ts     # 桶导出
│   └── main/
│       ├── index.ts     # Electron 入口
│       ├── window.ts    # 透明悬浮窗
│       ├── ipc.ts       # IPC 处理器（含 agent:execute / agent:getTools）
│       └── infra/       # 日志 / 配置 / 错误体系
├── preload/index.ts     # contextBridge 白名单 API
├── renderer/
│   ├── index.html       # 入口 HTML
│   ├── css/cat.css      # 精灵图动画
│   └── js/
│       ├── app.js       # wiring
│       ├── state.js     # 状态机
│       ├── core/
│       │   ├── api.js   # AI HTTP 客户端（chat + streamWithTools）
│       │   ├── agent.js # Agent 循环（Function Calling 编排）
│       │   ├── media.js # 摄像头 + 麦克风采集
│       │   └── tts.js   # Web Speech TTS
│       └── ui/          # Bubble / Settings / Sprite
└── tests/agent/         # 78 个单元测试（vitest）
```
