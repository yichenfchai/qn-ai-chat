/**
 * OpenAI-compatible Function Calling JSON Schemas
 *
 * 每个 schema 定义了一个工具的：
 *   - 名称、描述（AI 用来决定何时调用）
 *   - 参数 JSON Schema（AI 用来生成参数）
 *
 * 由 ToolCallingAgent 注入到 API 请求的 tools 字段。
 */

import { ToolDefinition } from './types';

/**
 * 所有可用的 agent 工具定义。
 * 渲染进程可直接 import 这个数组塞进 API 的 tools 参数。
 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取文件内容。用于查看文档、笔记、代码等文本文件。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件路径（绝对路径或相对于用户目录的路径）',
          },
          offset: {
            type: 'integer',
            description: '从第几行开始读取（1-indexed），默认 1',
            default: 1,
          },
          limit: {
            type: 'integer',
            description: '最多读取多少行，默认 500，最大 1000',
            default: 500,
          },
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
          path: {
            type: 'string',
            description: '文件路径（绝对路径或相对于用户目录的路径）',
          },
          content: {
            type: 'string',
            description: '要写入的完整内容',
          },
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
          path: {
            type: 'string',
            description: '目录路径，默认用户主目录',
          },
          showHidden: {
            type: 'boolean',
            description: '是否显示隐藏文件，默认 false',
            default: false,
          },
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
          command: {
            type: 'string',
            description: '要执行的命令（仅限白名单）。例如: "ipconfig /all", "ping -n 1 baidu.com", "dir C:\\Users"',
          },
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
          path: {
            type: 'string',
            description: '文件路径或 URL（以 http:// 或 https:// 开头）',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_directory',
      description: '创建新目录（文件夹）。用于帮用户在桌面/文档等位置新建文件夹。会自动创建所有不存在的父目录。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '目录路径（绝对路径或相对于用户目录的路径）',
          },
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
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

/** 按名称查找工具 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return AGENT_TOOLS.find(t => t.function.name === name);
}
