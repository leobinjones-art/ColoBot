/**
 * 插件管理器实现
 */

import type {
  Plugin,
  PluginManager,
  PluginContext,
  RuntimeTool,
  Middleware,
  Handler,
  Logger,
} from './types.js';

class PluginManagerImpl implements PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, RuntimeTool> = new Map();
  private middlewares: Middleware[] = [];
  private handlers: Map<string, Handler> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    const context: PluginContext = {
      logger: this.logger,
      config: {},
      registerTool: (tool: RuntimeTool) => {
        this.tools.set(tool.name, tool);
        this.logger.info(`Tool registered: ${tool.name} (from ${plugin.name})`);
      },
      registerMiddleware: (middleware: Middleware) => {
        this.middlewares.push(middleware);
        this.logger.info(`Middleware registered from ${plugin.name}`);
      },
      registerHandler: (name: string, handler: Handler) => {
        this.handlers.set(name, handler);
        this.logger.info(`Handler registered: ${name} (from ${plugin.name})`);
      },
    };

    // 注册插件提供的工具
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.tools.set(tool.name, tool);
      }
    }

    // 注册中间件
    if (plugin.middlewares) {
      this.middlewares.push(...plugin.middlewares);
    }

    // 注册处理器
    if (plugin.handlers) {
      for (const [name, handler] of Object.entries(plugin.handlers)) {
        this.handlers.set(name, handler);
      }
    }

    // 调用生命周期钩子
    if (plugin.onLoad) {
      await plugin.onLoad(context);
    }

    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    // 调用卸载钩子
    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    // 移除工具
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.tools.delete(tool.name);
      }
    }

    // 移除处理器
    if (plugin.handlers) {
      for (const name of Object.keys(plugin.handlers)) {
        this.handlers.delete(name);
      }
    }

    this.plugins.delete(name);
    this.logger.info(`Plugin unregistered: ${name}`);
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getTools(): RuntimeTool[] {
    return Array.from(this.tools.values());
  }

  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }

  getHandler(name: string): Handler | undefined {
    return this.handlers.get(name);
  }
}

/**
 * 创建插件管理器
 */
export function createPluginManager(logger: Logger): PluginManager {
  return new PluginManagerImpl(logger);
}

export type {
  Plugin,
  PluginManager,
  PluginContext,
  RuntimeTool,
  Middleware,
  Handler,
  Logger,
} from './types.js';
