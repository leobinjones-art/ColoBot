/**
 * 工具执行器实现
 */

import type { ToolCall, ToolResult, ToolContext } from '@colomind/types'
import type { ToolExecutor } from '../runtime/types.js'
import { ToolRegistry } from '../tools/registry.js'

export class ToolExecutorImpl implements ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  getTools() {
    return this.registry.getOpenAITools()
  }

  parse(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = []

    // Pattern 1: full XML tag with closing tag
    const fullRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
    let match
    while ((match = fullRegex.exec(content)) !== null) {
      this._parseInner(match[1], toolCalls)
    }

    // Pattern 2: open tag without closing (common in streaming)
    const openRegex = /<tool_call>\s*([\s\S]+?)\s*$/g
    if (toolCalls.length === 0 && openRegex.test(content)) {
      openRegex.lastIndex = 0
      while ((match = openRegex.exec(content)) !== null) {
        this._parseInner(match[1], toolCalls)
      }
    }

    return toolCalls
  }

  private _parseInner(inner: string, toolCalls: ToolCall[]) {
    inner = inner.trim()
    try {
      const parsed = JSON.parse(inner)
      toolCalls.push({
        id: parsed.id || crypto.randomUUID(),
        name: parsed.name,
        args: parsed.arguments || parsed.args || {},
        type: 'function',
        function: {
          name: parsed.name,
          arguments: JSON.stringify(parsed.arguments || parsed.args || {}),
        },
      })
      return
    } catch {}
    // Fallback: name{args} format like web_search{"query":"hello"}
    try {
      // Try JSON args: name{"key":"val"} or name{"key": "val"}
      const braceMatch = inner.match(/(\w+)\s*\{([\s\S]*)\}/)
      if (!braceMatch) {
        // Try Python-style: name(key="val", key2="val2")
        const pyMatch = inner.match(/(\w+)\s*\(([^)]*)\)/)
        if (pyMatch) {
          const args: Record<string, string> = {}
          const argsStr = pyMatch[2]
          for (const pair of argsStr.split(',')) {
            const kv = pair.trim().match(/(\w+)\s*=\s*["'](.+?)["']/)
            if (kv) args[kv[1]] = kv[2]
          }
          toolCalls.push({
            id: crypto.randomUUID(),
            name: pyMatch[1],
            args,
            type: 'function',
            function: {
              name: pyMatch[1],
              arguments: JSON.stringify(args),
            },
          })
          return
        }
      }
      if (braceMatch) {
        const args = JSON.parse(braceMatch[2])
        toolCalls.push({
          id: crypto.randomUUID(),
          name: braceMatch[1],
          args,
          type: 'function',
          function: {
            name: braceMatch[1],
            arguments: JSON.stringify(args),
          },
        })
      }
    } catch {}
  }

  async execute(calls: ToolCall[], context: ToolContext): Promise<ToolResult[]> {
    const results: ToolResult[] = []

    for (const call of calls) {
      try {
        const result = await this.registry.execute(call.name, call.args, context)
        results.push({
          toolCallId: call.id,
          name: call.name,
          result,
        })
      } catch (error) {
        results.push({
          toolCallId: call.id,
          name: call.name,
          result: '',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  format(results: ToolResult[]): string {
    return results
      .map((r) => {
        if (r.error) {
          return `<tool_result>\n${JSON.stringify({ name: r.name, error: r.error })}\n</tool_result>`
        }
        return `<tool_result>\n${JSON.stringify({ name: r.name, result: r.result })}\n</tool_result>`
      })
      .join('\n')
  }
}
