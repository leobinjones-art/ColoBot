/**
 * 工具执行器实现
 */

import type { ToolCall, ToolResult, ToolContext } from '@colobot/types';
import type { ToolExecutor } from '../runtime/types.js';
import { ToolRegistry } from '../tools/registry.js';

export class ToolExecutorImpl implements ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  parse(content: string): ToolCall[] {
    // 解析 XML 格式的工具调用
    const toolCalls: ToolCall[] = [];
    const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        toolCalls.push({
          id: parsed.id || crypto.randomUUID(),
          name: parsed.name,
          args: parsed.arguments || parsed.args || {},
          type: 'function',
          function: {
            name: parsed.name,
            arguments: JSON.stringify(parsed.arguments || parsed.args || {}),
          },
        });
      } catch {
        // 忽略解析错误
      }
    }

    return toolCalls;
  }

  async execute(calls: ToolCall[], context: ToolContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of calls) {
      try {
        const result = await this.registry.execute(call.name, call.args, context);
        results.push({
          toolCallId: call.id,
          name: call.name,
          result,
        });
      } catch (error) {
        results.push({
          toolCallId: call.id,
          name: call.name,
          result: '',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  format(results: ToolResult[]): string {
    return results
      .map(r => {
        if (r.error) {
          return `<tool_result>\n${JSON.stringify({ name: r.name, error: r.error })}\n</tool_result>`;
        }
        return `<tool_result>\n${JSON.stringify({ name: r.name, result: r.result })}\n</tool_result>`;
      })
      .join('\n');
  }
}
