/**
 * SOP Prompt 模板
 */

export type SopPromptName = 'taskAnalysis' | 'stepGuidance' | 'summarize' | 'review' | 'finalOutput';

export const SOP_PROMPTS: Record<SopPromptName, string> = {
  taskAnalysis: `分析以下用户消息，判断是否为学术研究任务。

用户消息：
"""{userMessage}"""

请以 JSON 格式回答：
{
  "isAcademicTask": true/false,
  "taskName": "任务名称",
  "researchPurpose": "paper" | "research" | "learning" | null,
  "informationComplete": true/false,
  "missingInfo": ["缺失信息"],
  "suggestedSteps": [
    { "name": "步骤名称", "description": "步骤描述" }
  ]
}

判断规则：
1. researchPurpose: paper=写论文, research=做研究, learning=学习
2. 步骤数量根据任务复杂度决定：简单2-4步，中等4-6步，复杂6-10步

直接输出 JSON。`,

  stepGuidance: `你是学术研究 SOP 流程引导助手。

当前任务：{taskName}
当前步骤：{stepNumber}/{totalSteps} - {stepName}
步骤描述：{stepDescription}

已完成步骤：
{completedSteps}

请生成简短引导文本（50-100字）。`,

  summarize: `你是学术研究 SOP 流程的父 Agent，负责整理汇总子 Agent 的工作成果。

任务：{taskName}
当前步骤：{stepNumber}/{totalSteps} - {stepName}

子 Agent 结果：
"""{subAgentResult}"""

请整理汇总，提取核心信息，保持结构清晰。`,

  review: `你是学术研究 SOP 流程的审核员。

任务：{taskName}
当前步骤：{stepNumber}/{totalSteps} - {stepName}

用户提交：
"""{userData}"""

子 Agent 结果：
"""{subAgentResult}"""

请审核是否满足步骤要求。以 JSON 格式回答：
{
  "approved": true/false,
  "reason": "如果不通过，说明原因",
  "suggestions": ["改进建议"]
}`,

  finalOutput: `你是学术写作助手。请根据研究流程的各步骤结果，生成完整的研究报告。

任务：{taskName}
摘要：{taskSummary}

各步骤结果：
{stepSummaries}

请生成 Markdown 格式研究报告，包含：
1. 标题
2. 摘要
3. 引言
4. 方法
5. 结果
6. 讨论
7. 结论
8. 参考文献（如有）`,
};

/**
 * 填充 Prompt 模板
 */
export function fillPrompt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}
