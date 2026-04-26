/**
 * 工作区文件工具
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';
import { getSubAgentWorkspacePath } from '../subagents/index.js';

const WORKSPACE_ROOT = '/workspace';

async function sandboxPath(subAgentId: string | undefined, wantedPath: string): Promise<string | null> {
  if (!subAgentId) return path.resolve(wantedPath);

  const workspace = getSubAgentWorkspacePath(subAgentId);
  if (!workspace) return null;

  const abs = path.resolve(wantedPath);
  if (!abs.startsWith(path.resolve(workspace) + path.sep) && abs !== workspace) {
    return null;
  }
  return abs;
}

async function readFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { file_path, sub_agent_id } = args as { file_path: string; sub_agent_id?: string };

  const safePath = await sandboxPath(sub_agent_id, file_path);
  if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

  try {
    const content = await fs.readFile(safePath, 'utf-8');
    return JSON.stringify({ ok: true, path: safePath, content, size: content.length });
  } catch (e: any) {
    if (e.code === 'ENOENT') throw new Error(`File not found: ${file_path}`);
    if (e.code === 'EISDIR') throw new Error(`Path is a directory: ${file_path}`);
    throw e;
  }
}

async function writeFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { file_path, content, sub_agent_id } = args as { file_path: string; content: string; sub_agent_id?: string };

  const safePath = await sandboxPath(sub_agent_id, file_path);
  if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

  try {
    await fs.mkdir(path.dirname(safePath), { recursive: true });
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw new Error(`Failed to create directory: ${e.message}`);
  }

  try {
    await fs.writeFile(safePath, content, 'utf-8');
    return JSON.stringify({ ok: true, path: safePath, size: content.length });
  } catch (e: any) {
    throw new Error(`Failed to write file: ${e.message}`);
  }
}

async function listDir(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { dir_path, sub_agent_id } = args as { dir_path?: string; sub_agent_id?: string };

  if (sub_agent_id) {
    const workspace = getSubAgentWorkspacePath(sub_agent_id);
    if (!workspace) throw new Error(`Access denied: sub-agent ${sub_agent_id} not found or expired`);
    const safePath = await sandboxPath(sub_agent_id, dir_path || workspace);
    if (!safePath) throw new Error(`Access denied: ${dir_path || workspace} is outside your workspace`);
    try {
      const entries = await fs.readdir(safePath, { withFileTypes: true });
      return JSON.stringify({ path: safePath, entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) });
    } catch (e: any) {
      if (e.code === 'ENOENT') throw new Error(`Directory not found: ${dir_path || workspace}`);
      throw e;
    }
  }

  const base = dir_path || WORKSPACE_ROOT;
  const safePath = path.resolve(base);
  try {
    const entries = await fs.readdir(safePath, { withFileTypes: true });
    return JSON.stringify({ path: safePath, entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) });
  } catch (e: any) {
    if (e.code === 'ENOENT') throw new Error(`Directory not found: ${base}`);
    throw e;
  }
}

async function deleteFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { file_path, sub_agent_id } = args as { file_path: string; sub_agent_id?: string };

  const safePath = await sandboxPath(sub_agent_id, file_path);
  if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

  try {
    await fs.unlink(safePath);
    return JSON.stringify({ ok: true, path: safePath });
  } catch (e: any) {
    if (e.code === 'ENOENT') throw new Error(`File not found: ${file_path}`);
    throw e;
  }
}

export function registerWorkspaceTools(): void {
  toolRegistry.register({
    name: 'read_file',
    description: 'Read file content from workspace',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File path to read' },
        sub_agent_id: { type: 'string', description: 'Sub-agent ID for sandbox isolation' },
      },
      required: ['file_path'],
    },
    execute: readFile,
  });

  toolRegistry.register({
    name: 'write_file',
    description: 'Write content to file in workspace',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        sub_agent_id: { type: 'string', description: 'Sub-agent ID for sandbox isolation' },
      },
      required: ['file_path', 'content'],
    },
    execute: writeFile,
  });

  toolRegistry.register({
    name: 'list_dir',
    description: 'List directory contents in workspace',
    parameters: {
      type: 'object',
      properties: {
        dir_path: { type: 'string', description: 'Directory path (default: workspace root)' },
        sub_agent_id: { type: 'string', description: 'Sub-agent ID for sandbox isolation' },
      },
      required: [],
    },
    execute: listDir,
  });

  toolRegistry.register({
    name: 'delete_file',
    description: 'Delete file from workspace',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File path to delete' },
        sub_agent_id: { type: 'string', description: 'Sub-agent ID for sandbox isolation' },
      },
      required: ['file_path'],
    },
    execute: deleteFile,
  });
}
