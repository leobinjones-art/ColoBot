/**
 * 文件系统适配器
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FileSystemAdapter {
  write(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  list(path: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}

/**
 * 本地文件系统适配器
 */
export class LocalFileSystemAdapter implements FileSystemAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
  }

  private resolvePath(p: string): string {
    // 防止路径遍历攻击
    const resolved = path.resolve(this.basePath, p);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  async write(filePath: string, content: string): Promise<void> {
    const resolved = this.resolvePath(filePath);
    const dir = path.dirname(resolved);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolved, content, 'utf-8');
  }

  async read(filePath: string): Promise<string> {
    const resolved = this.resolvePath(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  async list(dirPath: string): Promise<string[]> {
    const resolved = this.resolvePath(dirPath);
    if (!fs.existsSync(resolved)) {
      return [];
    }
    return fs.readdirSync(resolved);
  }

  async delete(filePath: string): Promise<void> {
    const resolved = this.resolvePath(filePath);
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }
}