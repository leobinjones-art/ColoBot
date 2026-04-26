/**
 * 内置工具集
 *
 * 包含：
 * - 文件操作：read_file, write_file, list_dir, delete_file
 * - 搜索：web_search
 * - 执行：python, shell
 * - 网络：http_request
 * - 数据：json_parse, csv_parse
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';
import { search, getSearchConfig } from '../search.js';

// ── 文件工具 ──────────────────────────────────────────────

/**
 * 读取文件
 */
async function readFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string;
  if (!filePath) throw new Error('path is required');

  const absolutePath = resolvePath(filePath, ctx);

  try {
    const content = await fs.promises.readFile(absolutePath, 'utf-8');
    return content;
  } catch (e: any) {
    throw new Error(`Failed to read file: ${e.message}`);
  }
}

/**
 * 写入文件
 */
async function writeFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string;
  const content = args.content as string;
  if (!filePath) throw new Error('path is required');
  if (content === undefined) throw new Error('content is required');

  const absolutePath = resolvePath(filePath, ctx);

  try {
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, content, 'utf-8');
    return `File written: ${filePath}`;
  } catch (e: any) {
    throw new Error(`Failed to write file: ${e.message}`);
  }
}

/**
 * 列出目录
 */
async function listDir(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const dirPath = (args.path as string) || '.';
  const absolutePath = resolvePath(dirPath, ctx);

  try {
    const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
    const result = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
    }));
    return JSON.stringify(result, null, 2);
  } catch (e: any) {
    throw new Error(`Failed to list directory: ${e.message}`);
  }
}

/**
 * 删除文件
 */
async function deleteFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string;
  if (!filePath) throw new Error('path is required');

  const absolutePath = resolvePath(filePath, ctx);

  try {
    await fs.promises.unlink(absolutePath);
    return `File deleted: ${filePath}`;
  } catch (e: any) {
    throw new Error(`Failed to delete file: ${e.message}`);
  }
}

/**
 * 解析路径（支持相对路径）
 */
function resolvePath(filePath: string, ctx: ToolContext): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  const basePath = ctx.workspace || process.cwd();
  return path.resolve(basePath, filePath);
}

// ── 搜索工具 ──────────────────────────────────────────────

/**
 * 网络搜索
 */
async function webSearch(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const query = args.query as string;
  if (!query) throw new Error('query is required');

  const maxResults = (args.maxResults as number) || getSearchConfig().maxResults;

  try {
    const response = await search(query, { maxResults });

    const results = response.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 200),
    }));

    return JSON.stringify(results, null, 2);
  } catch (e: any) {
    throw new Error(`Search failed: ${e.message}`);
  }
}

// ── 执行工具 ──────────────────────────────────────────────

/**
 * Python 执行（需要 python 可用）
 */
async function pythonExec(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const code = args.code as string;
  if (!code) throw new Error('code is required');

  const { execSync } = await import('child_process');

  try {
    const result = execSync('python3', {
      input: code,
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result;
  } catch (e: any) {
    return `Error: ${e.stderr || e.message}`;
  }
}

/**
 * Shell 执行（危险，需要白名单）
 */
async function shellExec(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const command = args.command as string;
  if (!command) throw new Error('command is required');

  const { execSync } = await import('child_process');

  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result;
  } catch (e: any) {
    return `Error: ${e.stderr || e.message}`;
  }
}

// ── 网络工具 ──────────────────────────────────────────────

/**
 * HTTP 请求
 */
async function httpRequest(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const url = args.url as string;
  const method = ((args.method as string) || 'GET').toUpperCase();
  const headers = (args.headers as Record<string, string>) || {};
  const body = args.body as string | undefined;

  if (!url) throw new Error('url is required');

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return JSON.stringify({
      status: response.status,
      ok: response.ok,
      data,
    }, null, 2);
  } catch (e: any) {
    throw new Error(`HTTP request failed: ${e.message}`);
  }
}

// ── 数据工具 ──────────────────────────────────────────────

/**
 * JSON 解析
 */
async function jsonParse(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const text = args.text as string;
  if (!text) throw new Error('text is required');

  try {
    const data = JSON.parse(text);
    return JSON.stringify(data, null, 2);
  } catch (e: any) {
    throw new Error(`JSON parse failed: ${e.message}`);
  }
}

/**
 * CSV 解析
 */
async function csvParse(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const text = args.text as string;
  const delimiter = (args.delimiter as string) || ',';
  if (!text) throw new Error('text is required');

  const lines = text.trim().split('\n');
  if (lines.length === 0) return '[]';

  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  });

  return JSON.stringify(rows, null, 2);
}

// ── 数学工具 ──────────────────────────────────────────────

/**
 * 数学计算
 */
async function calculate(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const expression = args.expression as string;
  if (!expression) throw new Error('expression is required');

  // 安全的数学表达式计算
  const safeEval = (expr: string): number => {
    // 只允许数字、运算符、括号、数学函数
    const allowed = /^[\d\s+\-*/().^%Math,sin,cos,tan,sqrt,abs,log,exp,pow,floor,ceil,round,PI,E]+$/;
    if (!allowed.test(expr)) {
      throw new Error('Invalid expression');
    }
    // 使用 Function 构造器安全执行
    return new Function(`"use strict"; return (${expr})`)();
  };

  try {
    const result = safeEval(expression);
    return String(result);
  } catch (e: any) {
    throw new Error(`Calculation failed: ${e.message}`);
  }
}

// ── 注册所有工具 ──────────────────────────────────────────────

export function registerBuiltinTools(): void {
  // 文件工具
  toolRegistry.register({
    name: 'read_file',
    description: 'Read file content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    execute: readFile,
  });

  toolRegistry.register({
    name: 'write_file',
    description: 'Write content to file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
    execute: writeFile,
  });

  toolRegistry.register({
    name: 'list_dir',
    description: 'List directory contents',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: current)' },
      },
      required: [],
    },
    execute: listDir,
  });

  toolRegistry.register({
    name: 'delete_file',
    description: 'Delete a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    execute: deleteFile,
  });

  // 搜索工具
  toolRegistry.register({
    name: 'web_search',
    description: 'Search the web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
    execute: webSearch,
  });

  // 执行工具
  toolRegistry.register({
    name: 'python',
    description: 'Execute Python code',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Python code to execute' },
      },
      required: ['code'],
    },
    execute: pythonExec,
  });

  toolRegistry.register({
    name: 'shell',
    description: 'Execute shell command (dangerous)',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command' },
      },
      required: ['command'],
    },
    execute: shellExec,
  });

  // 网络工具
  toolRegistry.register({
    name: 'http',
    description: 'Make HTTP request',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Request URL' },
        method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'object', description: 'Request body' },
      },
      required: ['url'],
    },
    execute: httpRequest,
  });

  // 数据工具
  toolRegistry.register({
    name: 'json_parse',
    description: 'Parse JSON string',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'JSON text' },
      },
      required: ['text'],
    },
    execute: jsonParse,
  });

  toolRegistry.register({
    name: 'csv_parse',
    description: 'Parse CSV string',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'CSV text' },
        delimiter: { type: 'string', description: 'Delimiter (default: ,)' },
      },
      required: ['text'],
    },
    execute: csvParse,
  });

  // 数学工具
  toolRegistry.register({
    name: 'calculate',
    description: 'Calculate mathematical expression',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression' },
      },
      required: ['expression'],
    },
    execute: calculate,
  });

  // 测试工具
  toolRegistry.register({
    name: 'echo',
    description: 'Echo back the input message',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    },
    execute: async (args) => (args.message as string) || '',
  });

  // 注册其他工具模块
  // 注意：这些函数在各自的文件中定义
}

// 导出所有工具注册函数
export { toolRegistry, tool } from './registry.js';
export { registerSearchTools } from './web-search.js';
export { registerWorkspaceTools } from './workspace.js';
export { registerExecCodeTool } from './exec-code.js';
export { registerSubagentTools } from './subagent.js';
export { registerAgentTools } from './agent-tools.js';
export { registerCreateSkillTool } from './create-skill.js';

/**
 * 注册所有工具
 */
export function registerAllTools(): void {
  registerBuiltinTools();
  registerSearchTools();
  registerWorkspaceTools();
  registerExecCodeTool();
  registerSubagentTools();
  registerAgentTools();
  registerCreateSkillTool();
}
