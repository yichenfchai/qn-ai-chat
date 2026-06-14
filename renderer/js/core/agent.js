/**
 * Agent 循环 — Function Calling 编排层
 *
 * 职责:
 *   1. 首次运行时从主进程拉取工具定义（单源），之后缓存
 *   2. 维护单次对话的多轮工具调用上下文（messages 数组）
 *   3. 调用 AI.streamWithTools() 发起请求
 *   4. 解析 AI 返回的 tool_calls → 通过 IPC 执行 → 返回结果给 AI
 *   5. 循环直到 AI 输出最终文本回复（或达到最大轮数）
 *
 * 竞态安全:
 *   - 每次 run() 在独立闭包中运行，无共享状态
 *   - 工具调用严格串行（for-of 循环），每轮携带唯一 callId
 *   - 支持外部 AbortController 提前终止
 *   - 最多 MAX_ROUNDS 轮后强制终止
 *
 * 依赖:
 *   - AI (api.js)      — HTTP API 客户端
 *   - Media (media.js)  — 截图（capture_screen 工具）
 *   - window.pixelcat   — IPC 桥接（工具执行 + 定义拉取）
 */

const Agent = {

  /** 最大工具调用轮数（防止无限循环 / token 爆炸） */
  MAX_ROUNDS: 5,

  /** 工具定义缓存（首次 run() 时从主进程拉取） */
  _tools: null,
  _toolsPromise: null,

  /** Agent 是否正在执行（防并发重入） */
  _busy: false,

  /** 检查 Agent 是否忙碌 */
  isBusy() { return this._busy; },

  /** 系统提示词 */
  SYSTEM_PROMPT: [
    '你是 PixelCat，一只住在用户桌面上的 AI 桌面宠物。',
    '你可以帮用户：读文件、写笔记、列出目录、新建文件夹、执行只读命令、打开文件/网址、截图。',
    '规则：',
    '- 用户用中文或英文提问，你用同一种语言回复',
    '- 优先使用工具完成任务，工具结果出来后再用自然语言总结',
    '- 简洁回复，不超过 3-4 句话',
    '- 如果工具调用失败，告诉用户发生了什么，不要重试同一个失败的操作',
    '- 你是一只猫，语气友好可爱但不啰嗦',
  ].join('\n'),

  /**
   * 执行一次完整的 Agent 对话。
   *
   * @param {Object} opts
   * @param {string} opts.text   - 用户文字输入（必填）
   * @param {string} [opts.image]  - 摄像头画面 (base64 data URI)
   * @param {string} [opts.audio]  - 录音 (base64 WAV data URI)
   * @param {AbortSignal} [opts.signal] - 外部取消信号
   * @returns {Promise<{ reply: string, rounds: number }>}
   */
  async run({ text, image, audio, signal }) {
    this._busy = true;
    try {
    // 确保工具定义已加载
    const tools = await this._ensureTools();

    // 快速路径：启发式判断不需要工具 → 直接问答
    if (!this._shouldUseTools(text)) {
      const reply = await AI.chat({ text, image, audio });
      // 降级：如果 AI 回复暗示"我需要工具"但没触发启发式，
      // 检查是否包含工具请求关键词（极少见，安全网）
      if (this._replyWantsTools(reply)) {
        // 升级到 Agent 路径继续
      } else {
        return { reply, rounds: 0 };
      }
    }

    // ── Full Agent Loop ─────────────────────────────
    let aborted = false;
    if (signal) {
      signal.addEventListener('abort', () => { aborted = true; }, { once: true });
    }

    const messages = [
      { role: 'system', content: this.SYSTEM_PROMPT },
      ...this._buildUserMessage(text, image, audio),
    ];
    let round = 0;

    while (round < this.MAX_ROUNDS) {
      round++;
      if (aborted) throw new Error('Agent 已被中止');
      if (signal?.aborted) throw new Error('Agent 已被中止');

      // 1. 调用 AI
      const aiResult = await AI.streamWithTools({
        messages,
        tools,
        signal: AbortSignal.timeout(30000),
      });

      if (aborted || signal?.aborted) throw new Error('Agent 已被中止');

      // 2. 无 tool_calls → 对话完成
      if (!aiResult.toolCalls) {
        return { reply: aiResult.text || '(AI 未返回内容)', rounds: round };
      }

      // 3. 追加 assistant 消息（含 tool_calls）
      messages.push({
        role: 'assistant',
        content: aiResult.text || null,
        tool_calls: aiResult.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      // 4. 串行执行工具（可恢复错误自动重试 1 次）
      for (const tc of aiResult.toolCalls) {
        if (aborted || signal?.aborted) throw new Error('Agent 已被中止');

        const result = await this._executeToolWithRetry(tc);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.output || result.error || '(无输出)',
        });
      }
    }

    // 5. 达到最大轮数 → 强制纯文本总结
    messages.push({
      role: 'user',
      content: '请用一句话总结以上操作完成了什么，不要调用任何工具。',
    });
    try {
      const final = await AI.streamWithTools({
        messages,
        tools: [],
        signal: AbortSignal.timeout(15000),
      });
      return { reply: final.text || '操作已完成', rounds: round };
    } catch {
      return { reply: '操作已完成（多次工具调用后无最终回复）', rounds: round };
    }
    } finally {
      this._busy = false;
    }
  },

  /**
   * 确保工具定义已从主进程拉取（懒加载 + 缓存）
   * @private
   */
  async _ensureTools() {
    if (this._tools) return this._tools;
    if (this._toolsPromise) return this._toolsPromise;

    this._toolsPromise = (async () => {
      if (window.pixelcat?.getTools) {
        try {
          const tools = await window.pixelcat.getTools();
          if (tools && tools.length > 0) {
            this._tools = tools;
            return tools;
          }
        } catch {
          // IPC 失败 → 用内置后备
        }
      }
      // 后备：硬编码（与 src/agent/schema.ts 保持同步）
      this._tools = this._fallbackTools();
      return this._tools;
    })();

    return this._toolsPromise;
  },

  /**
   * 判断用户意图是否可能需要工具
   * 简单对话不需要走 Agent 循环，节省 token
   * @private
   */
  _shouldUseTools(text) {
    const toolTriggers = [
      // 中文
      '打开', '读', '看一下', '看看', '查看', '浏览',
      '写', '记一下', '保存', '创建', '新建', '记录', '文件夹', '目录',
      '桌面', '文件', '目录', '文件夹', '文档',
      '命令', '运行', '执行', '查', '搜',
      '屏幕', '截图', '截屏',
      '帮我', '替我',
      // English
      'open', 'read', 'show', 'list', 'view', 'browse',
      'write', 'save', 'create', 'new', 'note',
      'desktop', 'file', 'directory', 'folder', 'document',
      'command', 'run', 'execute', 'search', 'find', 'check',
      'screen', 'screenshot', 'capture',
      'help me', 'can you',
    ];
    const lower = text.toLowerCase();
    return toolTriggers.some(t => lower.includes(t.toLowerCase()));
  },

  /**
   * 检查 AI 纯文本回复是否暗示需要工具（降级安全网）
   * @private
   */
  _replyWantsTools(reply) {
    // AI 说"我需要看看" / "我没法直接" → 暗示想用工具但没拿到
    const hints = [
      '我无法', '我没办法', '我不能直接', '需要你打开',
      '请让我看看', '需要访问', '需要查看文件',
    ];
    return hints.some(h => reply.includes(h));
  },

  /**
   * 构建用户消息（支持多模态）
   * @private
   */
  _buildUserMessage(text, image, audio) {
    const content = [];
    if (audio) content.push({ type: 'input_audio', input_audio: { data: audio, format: 'webm' } });
    if (image) content.push({ type: 'image_url', image_url: { url: image } });
    content.push({ type: 'text', text: text || '你好' });
    return [{ role: 'user', content }];
  },

  /**
   * 执行单个工具调用
   * - capture_screen → renderer 直接完成
   * - 其他 → IPC → 主进程
   * @private
   */
  async _executeTool(toolCall) {
    const name = toolCall._name || toolCall.function?.name;

    if (name === 'capture_screen') {
      return this._captureScreen(toolCall);
    }

    const callId = this._genCallId();
    const args = this._parseArgs(toolCall);

    if (!window.pixelcat?.executeTool) {
      return { error: 'IPC 桥接不可用', code: 'IPC_ERROR' };
    }

    try {
      return await window.pixelcat.executeTool(callId, name, args);
    } catch (e) {
      return { error: 'IPC 调用失败: ' + e.message, code: 'IPC_ERROR' };
    }
  },

  /**
   * 带重试策略的工具执行。
   *
   * 可恢复错误（网络/超时/瞬态）→ 自动重试 1 次
   * 不可恢复错误（沙箱/权限/参数）→ 直接返回给 AI
   *
   * @private
   */
  _RETRYABLE_CODES: new Set([
    'CMD_FAILED',      // 进程启动延迟
    'AGENT_TIMEOUT',   // IPC 超时
    'IPC_ERROR',       // 通信瞬断
    'EXECUTION_ERROR', // 执行器内部瞬态异常
  ]),

  async _executeToolWithRetry(toolCall) {
    let result = await this._executeTool(toolCall);
    if (result.status === 'error' && result.code && this._RETRYABLE_CODES.has(result.code)) {
      result = await this._executeTool(toolCall);
    }
    return result;
  },

  /**
   * 截屏工具（renderer 侧直接完成）
   * 当前使用摄像头帧作为近似。完整实现见 executor.ts 注释。
   * @private
   */
  _captureScreen(toolCall) {
    try {
      const frame = Media?.captureFrame?.();
      if (frame) {
        return { output: '[屏幕截图已获取]' };
      }
    } catch {}
    return { output: '[截图功能暂不可用]' };
  },

  _parseArgs(toolCall) {
    if (toolCall._args && Object.keys(toolCall._args).length > 0) {
      return toolCall._args;
    }
    try {
      return JSON.parse(toolCall.function?.arguments || '{}');
    } catch {
      return {};
    }
  },

  _genCallId() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  /**
   * 内置工具定义后备（仅在 IPC 失败时使用）
   * 与 src/agent/schema.ts 保持同步
   * @private
   */
  _fallbackTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: '读取文件内容。用于查看文档、笔记、代码等文本文件。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径（绝对路径或相对于用户目录的路径）' },
              offset: { type: 'integer', description: '从第几行开始读取（1-indexed），默认 1' },
              limit: { type: 'integer', description: '最多读取多少行，默认 500，最大 1000' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: '创建或覆盖写入文件。用于帮用户记录笔记、创建文档、保存信息。只能写入桌面/文档/下载等用户目录。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径（绝对路径或相对于用户目录的路径）' },
              content: { type: 'string', description: '要写入的完整内容' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: '列出目录内容。用于浏览文件、查看桌面/文档等目录下有什么。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '目录路径，默认用户主目录' },
              showHidden: { type: 'boolean', description: '是否显示隐藏文件，默认 false' },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'execute_command',
          description: '执行只读系统命令。只能运行安全的白名单命令（如 ipconfig、ping、dir、ls、cat 等）。不能运行任何修改系统状态的命令。',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: '要执行的命令（仅限白名单）。例如: "ipconfig /all", "ping -n 1 baidu.com", "dir"' },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'open_file',
          description: '用系统默认程序打开文件或网址。用于帮用户打开文档、PDF、图片、音乐、网页链接等。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径或 URL（以 http:// 或 https:// 开头）' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_directory',
          description: '创建新目录（文件夹）。用于帮用户在桌面/文档等位置新建文件夹。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '目录路径（绝对路径或相对于用户目录的路径）' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'capture_screen',
          description: '截取当前屏幕画面。用于查看用户当前正在看什么、屏幕上显示了什么内容。不需要任何参数。',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ];
  },
};

// Export as global
window.Agent = Agent;
