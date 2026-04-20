/**
 * 对话指令系统
 * 处理 /new, /reset, /compact, /model, /models, /reasoning, /thinking, /stop 等指令
 */

import { query } from '../memory/db.js';
import { sessionManager } from '../agents/session.js';
import { compressMessages, estimateMessagesTokens } from './compression.js';
import { getLlmSettings } from '../services/settings-cache.js';

export type ChatCommand =
  | 'new'
  | 'reset'
  | 'compact'
  | 'model'
  | 'models'
  | 'reasoning'
  | 'thinking'
  | 'stop'
  | 'help';

export interface CommandResult {
  success: boolean;
  message: string;
  action?: ChatCommand;
  data?: Record<string, unknown>;
}

/**
 * 解析用户消息，检测是否为指令
 */
export function parseCommand(message: string): { command: ChatCommand; args?: string } | null {
  const trimmed = message.trim();

  // 匹配 /command 或 /command args 格式
  const match = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (!match) return null;

  const cmd = match[1].toLowerCase() as ChatCommand;
  const args = match[2];

  const validCommands: ChatCommand[] = [
    'new', 'reset', 'compact', 'model', 'models',
    'reasoning', 'thinking', 'stop', 'help'
  ];

  if (!validCommands.includes(cmd)) return null;

  return { command: cmd, args };
}

/**
 * 执行指令
 */
export async function executeCommand(
  command: ChatCommand,
  args: string | undefined,
  context: {
    agentId: string;
    sessionKey: string;
    currentModel?: string;
    stopStreaming?: () => void;
  }
): Promise<CommandResult> {
  switch (command) {
    case 'new':
      return await handleNew(context);

    case 'reset':
      return await handleReset(context);

    case 'compact':
      return await handleCompact(context);

    case 'model':
      return await handleModel(args, context);

    case 'models':
      return await handleModels();

    case 'reasoning':
      return handleReasoning(args);

    case 'thinking':
      return handleThinking(args);

    case 'stop':
      return handleStop(context);

    case 'help':
      return handleHelp();

    default:
      return { success: false, message: `未知指令: /${command}` };
  }
}

/**
 * /new - 开启全新对话
 */
async function handleNew(context: { agentId: string; sessionKey: string }): Promise<CommandResult> {
  // 清空当前会话历史
  await sessionManager.updateContext(context.agentId, context.sessionKey, {});

  return {
    success: true,
    message: '✅ 已开启新对话，历史记录已清空。',
    action: 'new',
  };
}

/**
 * /reset - 在同一 session 内重置上下文
 */
async function handleReset(context: { agentId: string; sessionKey: string }): Promise<CommandResult> {
  const session = await sessionManager.get(context.agentId, context.sessionKey);
  const currentContext = session?.context || {};

  // 保留非历史数据，只清空 history
  const newContext = { ...currentContext, history: [] };
  await sessionManager.updateContext(context.agentId, context.sessionKey, newContext);

  return {
    success: true,
    message: '✅ 已重置当前对话上下文。',
    action: 'reset',
  };
}

/**
 * /compact - 压缩上下文
 */
async function handleCompact(context: { agentId: string; sessionKey: string }): Promise<CommandResult> {
  const history = await sessionManager.getHistory(context.agentId, context.sessionKey);

  if (!history || history.length === 0) {
    return {
      success: true,
      message: '当前对话为空，无需压缩。',
      action: 'compact',
    };
  }

  // 估算当前 token 数
  const messages = history.map(h => ({
    role: h.role as 'user' | 'assistant',
    content: h.content,
  }));
  const tokensBefore = estimateMessagesTokens(messages);

  // 压缩（目标 32k context window）
  const compressed = await compressMessages(messages, 32000);

  // 更新会话历史
  const newHistory = compressed.map(m => ({
    role: m.role,
    content: m.content,
  }));

  await sessionManager.updateContext(
    context.agentId,
    context.sessionKey,
    { history: newHistory }
  );

  const tokensAfter = estimateMessagesTokens(compressed);
  const saved = tokensBefore - tokensAfter;

  return {
    success: true,
    message: `✅ 上下文已压缩。\n压缩前: ${tokensBefore} tokens\n压缩后: ${tokensAfter} tokens\n节省: ${saved} tokens`,
    action: 'compact',
    data: { tokensBefore, tokensAfter, saved },
  };
}

/**
 * /model - 查看或切换当前模型
 */
async function handleModel(
  args: string | undefined,
  context: { currentModel?: string }
): Promise<CommandResult> {
  const settings = await getLlmSettings();
  const currentModel = context.currentModel || 'default';

  if (!args) {
    // 显示当前模型
    return {
      success: true,
      message: `当前模型: ${currentModel}\n提供商: ${settings.llm_provider}\n\n使用 /model <模型名> 切换模型`,
      action: 'model',
      data: { currentModel, provider: settings.llm_provider },
    };
  }

  // 切换模型（需要更新 agent 配置）
  return {
    success: true,
    message: `模型切换功能需要更新 Agent 配置。\n请求切换到: ${args}\n\n提示: 在 Dashboard 中修改 Agent 的 primary_model_id`,
    action: 'model',
    data: { requestedModel: args },
  };
}

/**
 * /models - 列出可用模型
 */
async function handleModels(): Promise<CommandResult> {
  try {
    const settings = await getLlmSettings();
    const provider = settings.llm_provider;

    // 常用模型列表
    const modelMap: Record<string, string[]> = {
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
      anthropic: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
      minimax: ['MiniMax-M2.7-highspeed', 'MiniMax-M2.7'],
    };

    const models = modelMap[provider] || [];

    if (models.length === 0) {
      return {
        success: true,
        message: '暂无可用模型，请检查 API 配置。',
        action: 'models',
      };
    }

    const modelList = models.map(m => `• ${m}`).join('\n');

    return {
      success: true,
      message: `可用模型 (${provider}):\n${modelList}`,
      action: 'models',
      data: { provider, models },
    };
  } catch (e) {
    return {
      success: false,
      message: `获取模型列表失败: ${(e as Error).message}`,
      action: 'models',
    };
  }
}

/**
 * /reasoning - 开启/关闭推理展示
 */
function handleReasoning(args: string | undefined): CommandResult {
  if (!args) {
    return {
      success: true,
      message: '用法: /reasoning on|off\n\n开启后会显示模型的思考过程。',
      action: 'reasoning',
    };
  }

  const enabled = args.toLowerCase() === 'on' || args.toLowerCase() === 'true';

  return {
    success: true,
    message: enabled
      ? '✅ 推理展示已开启（需要模型支持）'
      : '✅ 推理展示已关闭',
    action: 'reasoning',
    data: { reasoningEnabled: enabled },
  };
}

/**
 * /thinking - 调整思考强度
 */
function handleThinking(args: string | undefined): CommandResult {
  if (!args) {
    return {
      success: true,
      message: '用法: /thinking low|medium|high\n\n调整模型的思考程度（需要模型支持）。',
      action: 'thinking',
    };
  }

  const level = args.toLowerCase();
  const validLevels = ['low', 'medium', 'high'];

  if (!validLevels.includes(level)) {
    return {
      success: false,
      message: `无效的思考级别: ${level}\n有效值: low, medium, high`,
      action: 'thinking',
    };
  }

  return {
    success: true,
    message: `✅ 思考级别已设置为: ${level}`,
    action: 'thinking',
    data: { thinkingLevel: level },
  };
}

/**
 * /stop - 停止当前输出
 */
function handleStop(context: { stopStreaming?: () => void }): CommandResult {
  if (context.stopStreaming) {
    context.stopStreaming();
    return {
      success: true,
      message: '⏹️ 已停止输出',
      action: 'stop',
    };
  }

  return {
    success: true,
    message: '⏹️ 停止指令已接收',
    action: 'stop',
  };
}

/**
 * /help - 显示帮助
 */
function handleHelp(): CommandResult {
  const helpText = `📋 **对话指令帮助**

**对话管理**
• /new - 开启全新对话，清空历史
• /reset - 重置当前上下文
• /compact - 压缩上下文，节省 token

**模型控制**
• /model [名称] - 查看/切换当前模型
• /models - 列出可用模型

**推理控制**
• /reasoning on|off - 开启/关闭推理展示
• /thinking low|medium|high - 调整思考强度

**其他**
• /stop - 停止当前输出
• /help - 显示此帮助`;

  return {
    success: true,
    message: helpText,
    action: 'help',
  };
}
