/**
 * 工作区文件工具
 * 父 Agent 无限制，子 Agent 只能访问自身工作区
 */
import fs from 'fs/promises';
import path from 'path';
import { registerTool } from './executor.js';
import { getSubAgentWorkspacePath } from '../sub-agents.js';

const WORKSPACE_ROOT = '/workspace';

/**
 * 校验路径是否在指定工作区内（沙箱）
 * 返回绝对路径或 null（越权）
 */
async function sandboxPath(subAgentId: string | undefined, wantedPath: string): Promise<string | null> {
  // 无 subAgentId 表示父 Agent，不做限制
  if (!subAgentId) return path.resolve(wantedPath);

  const workspace = getSubAgentWorkspacePath(subAgentId);
  if (!workspace) return null; // 子 Agent 不存在

  const abs = path.resolve(wantedPath);
  // 必须落在 workspace 子树下
  if (!abs.startsWith(path.resolve(workspace) + path.sep) && abs !== workspace) {
    return null;
  }
  return abs;
}

function register() {
  registerTool('read_file', async (args) => {
    const { file_path, sub_agent_id } = args as { file_path: string; sub_agent_id?: string };

    const safePath = await sandboxPath(sub_agent_id, file_path);
    if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

    try {
      const content = await fs.readFile(safePath, 'utf-8');
      return { ok: true, path: safePath, content, size: content.length };
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'ENOENT') throw new Error(`File not found: ${file_path}`);
      if (err.code === 'EISDIR') throw new Error(`Path is a directory: ${file_path}`);
      throw e;
    }
  });

  registerTool('write_file', async (args) => {
    const { file_path, content, sub_agent_id } = args as { file_path: string; content: string; sub_agent_id?: string };

    const safePath = await sandboxPath(sub_agent_id, file_path);
    if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

    try {
      // 确保父目录存在
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, 'utf-8');
      return { ok: true, path: safePath, size: content.length };
    } catch (e) {
      throw new Error(`Failed to write file: ${e}`);
    }
  });

  registerTool('list_dir', async (args) => {
    const { dir_path, sub_agent_id } = args as { dir_path?: string; sub_agent_id?: string };

    const base = sub_agent_id
      ? (getSubAgentWorkspacePath(sub_agent_id) ?? WORKSPACE_ROOT)
      : (dir_path || WORKSPACE_ROOT);

    const safePath = await sandboxPath(sub_agent_id, base);
    if (!safePath) throw new Error(`Access denied: ${base} is outside your workspace`);

    try {
      const entries = await fs.readdir(safePath, { withFileTypes: true });
      return {
        path: safePath,
        entries: entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
        })),
      };
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'ENOENT') throw new Error(`Directory not found: ${base}`);
      throw e;
    }
  });

  registerTool('delete_file', async (args) => {
    const { file_path, sub_agent_id } = args as { file_path: string; sub_agent_id?: string };

    const safePath = await sandboxPath(sub_agent_id, file_path);
    if (!safePath) throw new Error(`Access denied: ${file_path} is outside your workspace`);

    try {
      await fs.unlink(safePath);
      return { ok: true, path: safePath };
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'ENOENT') throw new Error(`File not found: ${file_path}`);
      throw e;
    }
  });
}

export function registerTools(): void {
  register();
}
