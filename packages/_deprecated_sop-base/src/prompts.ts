/**
 * SOP 基础 Prompt 模板
 */

// ─── 任务分析 Prompt ──────────────────────────────────────────────

export const TASK_ANALYSIS_PROMPT = `你是一个任务分析专家。分析用户的请求，将其分解为标准化的步骤。

用户请求：
{userMessage}

上下文：
{context}

请返回 JSON 格式：
{
  "type": "任务类型",
  "description": "任务描述",
  "steps": [
    {
      "name": "步骤名称",
      "description": "步骤描述",
      "dependencies": ["依赖的步骤ID（可选）"]
    }
  ],
  "requiredTools": ["需要的工具（可选）"],
  "estimatedTime": 预估时间（分钟，可选）,
  "complexity": 复杂度评分1-10（可选）
}

要求：
1. 步骤应该独立可执行
2. 标明步骤之间的依赖关系
3. 步骤数量控制在 {maxSteps} 以内
4. 每个步骤描述清晰明确`

// ─── 步骤执行 Prompt ──────────────────────────────────────────────

export const STEP_EXECUTION_PROMPT = `执行以下步骤：

步骤名称：{stepName}
步骤描述：{stepDescription}

任务上下文：
{taskContext}

前置步骤结果：
{previousResults}

请完成该步骤并返回结果。`

// ─── 输出生成 Prompt ──────────────────────────────────────────────

export const OUTPUT_GENERATION_PROMPT = `根据以下步骤结果生成最终输出：

任务类型：{taskType}
任务描述：{taskDescription}

步骤结果：
{stepResults}

请生成完整、结构化的最终输出。`

// ─── 进度汇报 Prompt ──────────────────────────────────────────────

export const PROGRESS_REPORT_PROMPT = `汇报当前任务进度：

任务：{taskDescription}
当前步骤：{currentStep}
已完成步骤：{completedSteps}
剩余步骤：{remainingSteps}

请生成简洁的进度汇报。`

// ─── 错误处理 Prompt ──────────────────────────────────────────────

export const ERROR_HANDLING_PROMPT = `步骤执行失败，请分析并提供解决方案：

失败步骤：{stepName}
错误信息：{error}

任务上下文：
{taskContext}

请提供：
1. 错误原因分析
2. 建议的解决方案
3. 是否需要重试或跳过`

// ─── Prompt 构建器 ──────────────────────────────────────────────

export function buildPrompt(
  template: string,
  variables: Record<string, string | number | object>,
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    result = result.replace(placeholder, replacement)
  }
  return result
}
