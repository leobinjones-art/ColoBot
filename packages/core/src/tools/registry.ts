/**
 * 工具注册表
 */

import type { RuntimeTool, ToolContext } from '@colobot/types';

/**
 * 工具注册表
 */
export class ToolRegistry {
  private tools: Map<string, RuntimeTool> = new Map();

  register(tool: RuntimeTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }

  get(name: string): RuntimeTool | undefined {
    return this.tools.get(name);
  }

  list(): RuntimeTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取 OpenAI 格式的工具定义
   */
  getOpenAITools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.list().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(args, context);
  }
}

/**
 * 全局工具注册表
 */
export const toolRegistry = new ToolRegistry();

/**
 * 装饰器：注册工具
 */
export function tool(options: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(args: Record<string, unknown>, ctx: ToolContext) => Promise<string>>
  ) {
    const execute = descriptor.value!;
    toolRegistry.register({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
      execute,
    });
  };
}
