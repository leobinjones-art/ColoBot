/**
 * 国际化支持
 */

export type Locale = 'zh' | 'en';

/**
 * 检测文本语言
 */
export function detectLocale(text: string): Locale {
  // 检测中文字符
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }
  return 'en';
}

/**
 * 语言包类型
 */
export interface I18nMessages {
  // SOP 流程相关
  sop: {
    cancelled: string;
    paused: (currentStep: number, totalSteps: number) => string;
    resumed: (currentStep: number, totalSteps: number) => string;
    restarted: (step: number) => string;
    completed: string;
    purposeSelection: (taskName: string) => string;
    breakdownConfirm: string;
    stepSubmitted: string;
    stepRejected: (reason: string) => string;
    stepAdvanced: (step: number, stepName: string) => string;
    finalOutputReady: string;
    finalOutputGenerated: (downloadUrl?: string) => string;
    taskList: (tasks: Array<{ taskName: string; status: string }>) => string;
    noActiveTask: string;
  };
  // 通用错误
  errors: {
    messageBlocked: string;
    outputBlocked: string;
    noApprovalRequest: (approvalId: string) => string;
    approvalFailed: (error: string) => string;
    noPendingApprovals: string;
    subAgentLimitReached: (limit: number) => string;
  };
  // 命令响应
  commands: {
    modelSwitch: (model: string) => string;
    noModelsAvailable: string;
    modelListFailed: (error: string) => string;
    approvalNotFound: (approvalId: string) => string;
    approvalActionFailed: (error: string) => string;
  };
}

/**
 * 中文语言包
 */
export const zhMessages: I18nMessages = {
  sop: {
    cancelled: '✅ SOP 流程已取消。发送新任务开始新流程。',
    paused: (currentStep, totalSteps) => `⏸️ SOP 流程已暂停。进度：步骤 ${currentStep}/${totalSteps}。发送"继续"恢复。`,
    resumed: (currentStep, totalSteps) => `🔄 SOP 流程已恢复。当前步骤：${currentStep}/${totalSteps}`,
    restarted: (step) => `🔄 步骤 ${step} 已重启。`,
    completed: '🎉 所有步骤已完成！是否生成最终输出（论文/报告）？回复"是"或"否"。',
    purposeSelection: (taskName) => `检测到学术任务：**${taskName}**\n\n请选择研究目的：\n\n1. **写论文** - 发表期刊/毕业论文\n2. **做研究** - 科学研究、实验、分析\n3. **学习** - 学习某个领域的知识\n\n请回复数字或描述您的目的。`,
    breakdownConfirm: '请回复"确认"开始执行，或提出修改意见。',
    stepSubmitted: '步骤已完成。回复"确认"继续下一步，或提出修改意见。',
    stepRejected: (reason) => `❌ 审核未通过：${reason}\n\n请改进后重新提交。`,
    stepAdvanced: (step, stepName) => `✅ 已进入步骤 ${step}：**${stepName}**`,
    finalOutputReady: '🎉 所有步骤已完成！是否生成最终输出（论文/报告）？回复"是"或"否"。',
    finalOutputGenerated: (downloadUrl) => downloadUrl
      ? `✅ 报告已生成！[下载](${downloadUrl})`
      : '✅ 报告已生成！',
    taskList: (tasks) => tasks.length > 0
      ? `📋 **活跃任务**\n\n${tasks.map((t, i) => `${i + 1}. ${t.taskName} (${t.status})`).join('\n')}`
      : '暂无活跃任务。发送新任务开始。',
    noActiveTask: '暂无进行中的 SOP 流程。发送新任务开始。',
  },
  errors: {
    messageBlocked: '抱歉，您的消息无法处理。请调整内容后重试。',
    outputBlocked: '抱歉，回复内容无法呈现。请稍后重试。',
    noApprovalRequest: (approvalId) => `❌ 未找到待审批请求: ${approvalId}\n可能已被处理或已过期`,
    approvalFailed: (error) => `审批操作失败: ${error}`,
    noPendingApprovals: '📭 当前没有待审批的请求',
    subAgentLimitReached: (limit) => `子Agent并发已达上限(${limit})，请稍后再试`,
  },
  commands: {
    modelSwitch: (model) => `模型切换功能需要更新 Agent 配置。\n请求切换到: ${model}\n\n提示: 在 Dashboard 中修改 Agent 的 primary_model_id`,
    noModelsAvailable: '暂无可用模型，请检查 API 配置。',
    modelListFailed: (error) => `获取模型列表失败: ${error}`,
    approvalNotFound: (approvalId) => `❌ 未找到待审批请求: ${approvalId}\n可能已被处理或已过期`,
    approvalActionFailed: (error) => `审批操作失败: ${error}`,
  },
};

/**
 * 英文语言包
 */
export const enMessages: I18nMessages = {
  sop: {
    cancelled: '✅ SOP workflow cancelled. Send a new task to start over.',
    paused: (currentStep, totalSteps) => `⏸️ SOP workflow paused. Progress: Step ${currentStep}/${totalSteps}. Send "continue" to resume.`,
    resumed: (currentStep, totalSteps) => `🔄 SOP workflow resumed. Current step: ${currentStep}/${totalSteps}`,
    restarted: (step) => `🔄 Step ${step} has been restarted.`,
    completed: '🎉 All steps completed! Generate final output (paper/report)? Reply "yes" or "no".',
    purposeSelection: (taskName) => `Academic task detected: **${taskName}**\n\nPlease select your purpose:\n\n1. **Write Paper** - Journal publication/Thesis\n2. **Research** - Scientific research, experiments, analysis\n3. **Learning** - Learn about a specific field\n\nPlease reply with a number or describe your purpose.`,
    breakdownConfirm: 'Please reply "confirm" to start, or suggest modifications.',
    stepSubmitted: 'Step completed. Reply "confirm" to continue, or suggest modifications.',
    stepRejected: (reason) => `❌ Review failed: ${reason}\n\nPlease improve and resubmit.`,
    stepAdvanced: (step, stepName) => `✅ Advanced to step ${step}: **${stepName}**`,
    finalOutputReady: '🎉 All steps completed! Generate final output (paper/report)? Reply "yes" or "no".',
    finalOutputGenerated: (downloadUrl) => downloadUrl
      ? `✅ Report generated! [Download](${downloadUrl})`
      : '✅ Report generated!',
    taskList: (tasks) => tasks.length > 0
      ? `📋 **Active Tasks**\n\n${tasks.map((t, i) => `${i + 1}. ${t.taskName} (${t.status})`).join('\n')}`
      : 'No active tasks. Send a new task to start.',
    noActiveTask: 'No active SOP workflow. Send a new task to start.',
  },
  errors: {
    messageBlocked: 'Sorry, your message cannot be processed. Please adjust and try again.',
    outputBlocked: 'Sorry, the response cannot be displayed. Please try again later.',
    noApprovalRequest: (approvalId) => `❌ Approval request not found: ${approvalId}\nIt may have been processed or expired.`,
    approvalFailed: (error) => `Approval action failed: ${error}`,
    noPendingApprovals: '📭 No pending approval requests.',
    subAgentLimitReached: (limit) => `Sub-agent concurrency limit reached (${limit}). Please try again later.`,
  },
  commands: {
    modelSwitch: (model) => `Model switching requires updating Agent configuration.\nRequested: ${model}\n\nTip: Modify the Agent's primary_model_id in Dashboard.`,
    noModelsAvailable: 'No models available. Please check API configuration.',
    modelListFailed: (error) => `Failed to get model list: ${error}`,
    approvalNotFound: (approvalId) => `❌ Approval request not found: ${approvalId}\nIt may have been processed or expired.`,
    approvalActionFailed: (error) => `Approval action failed: ${error}`,
  },
};

/**
 * 获取语言包
 */
export function getMessages(locale: Locale): I18nMessages {
  return locale === 'zh' ? zhMessages : enMessages;
}
