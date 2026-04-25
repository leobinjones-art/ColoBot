/**
 * 内置工具
 */

import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';

/**
 * echo 工具 - 测试用
 */
async function echo(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  return (args.message as string) || '';
}

/**
 * 注册内置工具
 */
export function registerBuiltinTools(): void {
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
    execute: echo,
  });
}

export { toolRegistry, tool } from './registry.js';
