/**
 * SOP Prompt 配置
 * 优先级：数据库 > 环境变量 > 默认值
 */

export type SopPromptName = 'taskAnalysis' | 'stepGuidance' | 'summarizeSubAgent' | 'reviewStep' | 'finalOutput';

export const SOP_PROMPTS = {
  /**
   * 任务分析 Prompt
   */
  taskAnalysis: `分析以下用户消息，判断是否为学术研究任务。

用户消息：
"""{userMessage}"""

请以 JSON 格式回答：
{
  "isAcademicTask": true/false,
  "taskName": "任务名称（简短概括）",
  "researchPurpose": "paper" | "research" | "learning" | null,
  "informationComplete": true/false,
  "missingInfo": ["缺失信息1", "缺失信息2"],
  "suggestedSteps": [
    { "step": 1, "name": "步骤名称", "description": "步骤描述" },
    ...
  ]
}

判断规则：
1. researchPurpose 判断：
   - "paper"：用户明确要写论文、发表期刊、毕业论文
   - "research"：用户要做科学研究、实验、分析，不是写论文
   - "learning"：用户想学习某个领域的知识
   - null：无法判断或不是学术任务

2. 如果用户说"学术研究"、"做研究"、"科研"等，researchPurpose = "research"

3. 如果用户只是说"开始学术"、"开始研究"等意图表达，但没有提供具体课题/主题，则 informationComplete = false，missingInfo 应包含"课题主题"、"研究目的"等

4. **步骤数量必须根据任务复杂度灵活决定**：
   - 简单任务：2-4 步（如快速调研、简单学习）
   - 中等任务：4-6 步（如标准研究、课程论文）
   - 复杂任务：6-10 步（如毕业论文、大型研究项目）
   - 不要总是生成相同数量的步骤，要根据实际需求调整

直接输出 JSON，不要有其他内容。`,

  /**
   * 步骤引导 Prompt
   */
  stepGuidance: `你是学术研究 SOP 流程引导助手。

当前任务：{taskName}
当前步骤：{stepNumber}/{totalSteps} - {stepName}
步骤描述：{stepDescription}

已完成步骤：
{completedSteps}

请生成一段简短的引导文本（50-100字），引导用户完成当前步骤。`,

  /**
   * 子 Agent 结果汇总 Prompt
   */
  summarizeSubAgent: `你是学术研究SOP流程的父Agent，负责整理汇总子Agent的工作成果。

任务信息：
- 任务名称：{taskName}
- 当前步骤：{stepNumber}/{totalSteps} - {stepName}

子Agent返回的结果：
"""{subAgentResult}"""

请整理汇总以上内容，要求：
1. 提取核心信息，去除冗余
2. 保持结构清晰
3. 如果有表格或列表，保持格式

直接输出整理后的内容，不要有其他说明。`,

  /**
   * 步骤审核 Prompt
   */
  reviewStep: `你是学术研究 SOP 流程的审核员。

任务信息：
- 任务名称：{taskName}
- 当前步骤：{stepNumber}/{totalSteps} - {stepName}
- 步骤描述：{stepDescription}

用户提交的内容：
"""{userData}"""

子Agent处理结果：
"""{subAgentResult}"""

请审核以上内容是否满足当前步骤的要求。

以 JSON 格式回答：
{
  "approved": true/false,
  "reason": "如果不通过，说明原因",
  "suggestions": ["改进建议1", "改进建议2"]
}

审核标准：
1. 内容是否与当前步骤相关
2. 是否有实质性的进展
3. 是否符合学术规范

直接输出 JSON，不要有其他内容。`,

  /**
   * 最终输出生成 Prompt
   */
  finalOutput: `你是一个学术写作助手。请根据以下研究流程的各步骤结果，生成一份完整的研究报告。

# 任务信息
- 任务名称：{taskName}
- 任务摘要：{taskSummary}

# 各步骤结果

{stepSummaries}

# 输出要求

请生成一份结构化的 Markdown 格式研究报告，包含：

1. **标题**：简洁明了的研究标题
2. **摘要**：200-300字的研究摘要
3. **引言**：研究背景和意义
4. **方法**：研究方法和实验设计
5. **结果**：主要研究发现（基于步骤结果）
6. **讨论**：结果分析和局限性
7. **结论**：总结和未来工作
8. **参考文献**：列出提到的文献（如有）

请直接输出 Markdown 格式的报告内容。`,
};

// 缓存数据库配置
let cachedPrompts: Record<string, string> | null = null;

/**
 * 从数据库加载 SOP Prompts
 */
export async function loadSopPromptsFromDb(): Promise<Record<string, string>> {
  if (cachedPrompts) return cachedPrompts;

  try {
    const { query } = await import('../memory/db.js');
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM agent_settings WHERE setting_key LIKE 'sop_prompt_%'`
    );

    const prompts: Record<string, string> = {};
    for (const row of rows) {
      const name = row.setting_key.replace('sop_prompt_', '');
      prompts[name] = row.setting_value;
    }

    cachedPrompts = Object.keys(prompts).length > 0 ? prompts : null;
    return prompts;
  } catch (e) {
    console.error('[SOP] Failed to load prompts from DB:', e);
    return {};
  }
}

/**
 * 保存 SOP Prompt 到数据库
 */
export async function saveSopPromptToDb(name: string, value: string): Promise<void> {
  const { query } = await import('../memory/db.js');
  await query(
    `INSERT INTO agent_settings (setting_key, setting_value, description, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
    [`sop_prompt_${name}`, value, `SOP Prompt: ${name}`]
  );
  cachedPrompts = null; // 清除缓存
}

/**
 * 获取 Prompt 模板
 * 优先级：数据库 > 环境变量 > 默认值
 */
export async function getSopPromptAsync(name: SopPromptName): Promise<string> {
  // 1. 检查数据库
  const dbPrompts = await loadSopPromptsFromDb();
  if (dbPrompts[name]) {
    return dbPrompts[name];
  }

  // 2. 检查环境变量
  const envKey = `SOP_PROMPT_${name.toUpperCase()}`;
  if (process.env[envKey]) {
    return process.env[envKey]!;
  }

  // 3. 返回默认值
  return SOP_PROMPTS[name];
}

/**
 * 获取 Prompt 模板（同步版本，用于向后兼容）
 */
export function getSopPrompt(name: SopPromptName): string {
  const envKey = `SOP_PROMPT_${name.toUpperCase()}`;
  return process.env[envKey] || SOP_PROMPTS[name];
}

/**
 * 获取所有 Prompts（包含来源信息）
 */
export async function getAllSopPrompts(): Promise<Record<string, { value: string; source: 'db' | 'env' | 'default' }>> {
  const result: Record<string, { value: string; source: 'db' | 'env' | 'default' }> = {};

  const dbPrompts = await loadSopPromptsFromDb();

  for (const name of Object.keys(SOP_PROMPTS) as SopPromptName[]) {
    const envKey = `SOP_PROMPT_${name.toUpperCase()}`;

    if (dbPrompts[name]) {
      result[name] = { value: dbPrompts[name], source: 'db' };
    } else if (process.env[envKey]) {
      result[name] = { value: process.env[envKey]!, source: 'env' };
    } else {
      result[name] = { value: SOP_PROMPTS[name], source: 'default' };
    }
  }

  return result;
}

/**
 * 填充 Prompt 模板
 */
export function fillPrompt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}
