/**
 * @colobot/core - 插件系统
 */

import type { RuntimeTool, ToolContext, ToolResult } from '@colobot/types';

// 重新导出
export type { RuntimeTool, ToolContext, ToolResult } from '@colobot/types';

/**
 * 插件定义
 */
export interface Plugin {
  name: string;
  version: string;
  description?: string;

  // 生命周期钩子
  onLoad?(context: PluginContext): Promise<void> | void;
  onUnload?(): Promise<void> | void;

  // 提供的能力
  tools?: RuntimeTool[];
  middlewares?: Middleware[];
  handlers?: Record<string, Handler>;
}

/**
 * 插件上下文
 */
export interface PluginContext {
  logger: Logger;
  config: Record<string, unknown>;
  registerTool(tool: RuntimeTool): void;
  registerMiddleware(middleware: Middleware): void;
  registerHandler(name: string, handler: Handler): void;
}

/**
 * 日志接口
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * 中间件
 */
export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

export interface MiddlewareContext {
  agentId: string;
  sessionKey: string;
  message: unknown;
  metadata: Record<string, unknown>;
}

/**
 * 处理器
 */
export type Handler = (input: unknown, context: ToolContext) => Promise<unknown>;

/**
 * 插件管理器
 */
export interface PluginManager {
  register(plugin: Plugin): Promise<void>;
  unregister(name: string): Promise<void>;
  get(name: string): Plugin | undefined;
  list(): Plugin[];

  getTools(): RuntimeTool[];
  getMiddlewares(): Middleware[];
  getHandler(name: string): Handler | undefined;
}
