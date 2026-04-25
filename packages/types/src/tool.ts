/**
 * Tool 相关类型
 */

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 工具结果
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}

// 工具执行上下文
export interface ToolContext {
  agentId: string;
  sessionKey: string;
  sessionId?: string;
  userId?: string;
  workspace?: string;
  timeout?: number;
  ipAddress?: string;
}

// 工具定义（运行时）
export interface RuntimeTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
}
