/**
 * SOP 流程处理器 - AI 驱动的完整流程控制
 *
 * 入口函数：handleSopFlow
 */

import {
  aiAnalyzeTask,
  getActiveSopTask,
  listActiveSopTasks,
  createSop,
  getSopState,
  generateStepGuidance,
  submitUserData,
  aiReviewSubAgentOutput,
  approveAndAdvance,
  rejectAndRetry,
  confirmTaskBreakdown,
  cancelSop,
  restartStep,
  detectExitIntent,
  detectRestartIntent,
  detectConfirmation,
  detectModification,
  formatSopStatus,
  formatTaskBreakdown,
  type SopState,
} from './sop-v2.js';

export interface SopFlowResult {
  response: string;
  state: SopState | null;
  action: 'created' | 'continued' | 'confirmed' | 'submitted' | 'reviewed' | 'advanced' | 'rejected' | 'cancelled' | 'restarted' | 'none';
}

/**
 * SOP 流程主入口
 */
export async function handleSopFlow(
  userMessage: string,
  agentId: string,
  sessionKey: string
): Promise<SopFlowResult> {
  // 1. 检测退出意图
  if (detectExitIntent(userMessage)) {
    const state = await getActiveSopTask(agentId, sessionKey);
    if (state) {
      await cancelSop(state);
      return {
        response: '已退出 SOP 流程。如需继续，请重新发送任务。',
        state: null,
        action: 'cancelled',
      };
    }
    return {
      response: '当前没有进行中的 SOP 流程。',
      state: null,
      action: 'none',
    };
  }

  // 2. 获取当前活跃任务
  let state = await getActiveSopTask(agentId, sessionKey);

  // 3. 检测重启意图
  const restartStepNum = detectRestartIntent(userMessage);
  if (restartStepNum !== null && state) {
    state = await restartStep(state, restartStepNum);
    const guidance = await generateStepGuidance(state);
    return {
      response: `已重启步骤 ${restartStepNum}。\n\n${guidance}`,
      state,
      action: 'restarted',
    };
  }

  // 4. 无活跃任务，分析是否为新任务
  if (!state) {
    const analysis = await aiAnalyzeTask(userMessage);

    if (!analysis.isAcademicTask) {
      return {
        response: '',
        state: null,
        action: 'none',
      };
    }

    // 检查是否有多个进行中的任务
    const allTasks = await listActiveSopTasks(agentId);
    if (allTasks.length > 0) {
      const taskList = allTasks.map((t, i) =>
        `${i + 1}. ${t.taskName}（步骤 ${t.currentStep}/${t.steps.length}）`
      ).join('\n');

      return {
        response: `你有以下进行中的任务：\n${taskList}\n\n请回复序号选择要继续的任务，或回复"新建"开始新任务。`,
        state: null,
        action: 'none',
      };
    }

    // 创建新任务
    state = await createSop(agentId, sessionKey, analysis, userMessage);

    // 展示任务拆解结果
    const breakdown = formatTaskBreakdown(state);
    return {
      response: breakdown,
      state,
      action: 'created',
    };
  }

  // 5. 步骤1：任务拆解确认
  if (state.currentStep === 1 && state.steps[0]?.status === 'in_progress') {
    // 检测修改意图
    if (detectModification(userMessage)) {
      // 重新分析并拆解
      const analysis = await aiAnalyzeTask(userMessage + '\n\n用户修改意见：' + userMessage);
      if (analysis.isAcademicTask) {
        state.steps = analysis.suggestedSteps.map((s, i) => ({
          ...s,
          step: i + 1,
          status: i === 0 ? 'in_progress' : 'pending',
          userData: null,
          subAgentResult: null,
          approved: false,
          reviewNote: null,
          subAgentId: null,
        }));
        state.taskName = analysis.taskName;
        await createSop(agentId, sessionKey, analysis, state.taskSummary);
        return {
          response: formatTaskBreakdown(state),
          state,
          action: 'created',
        };
      }
    }

    // 检测确认
    if (detectConfirmation(userMessage)) {
      state = await confirmTaskBreakdown(state, true);
      const guidance = await generateStepGuidance(state);
      return {
        response: `任务拆解已确认，开始执行。\n\n${guidance}`,
        state,
        action: 'confirmed',
      };
    }

    // 用户未确认，继续等待确认
    return {
      response: '请确认任务拆解结果。回复"确认"开始执行，或提出修改意见。',
      state,
      action: 'none',
    };
  }

  // 6. 中间步骤：用户提交数据
  const currentStep = state.steps[state.currentStep - 1];
  if (currentStep?.status === 'in_progress' && !currentStep.subAgentResult) {
    // 用户提交数据
    const { state: newState, subAgentResult } = await submitUserData(state, userMessage);

    // AI 审核
    const review = await aiReviewSubAgentOutput(newState);

    if (review.approved) {
      // 审核通过，展示结果并等待用户确认
      const status = formatSopStatus(newState);
      return {
        response: `**子 Agent 处理结果：**\n\n${subAgentResult}\n\n---\n\n${status}\n\n回复"确认"继续下一步，或提出修改意见。`,
        state: newState,
        action: 'submitted',
      };
    } else {
      // 审核打回
      const rejectedState = await rejectAndRetry(newState, review.reason);
      return {
        response: `**审核未通过：** ${review.reason}\n\n**改进建议：**\n${review.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n请重新提交数据。`,
        state: rejectedState,
        action: 'rejected',
      };
    }
  }

  // 7. 等待用户确认审核结果
  if (currentStep?.subAgentResult && !currentStep.approved) {
    if (detectConfirmation(userMessage)) {
      state = await approveAndAdvance(state);

      if (state.status === 'completed') {
        return {
          response: '🎉 所有步骤已完成！\n\n是否需要生成最终输出（论文/报告）？回复"是"或"否"。',
          state,
          action: 'advanced',
        };
      }

      const guidance = await generateStepGuidance(state);
      return {
        response: `已进入下一步。\n\n${guidance}`,
        state,
        action: 'advanced',
      };
    }

    // 用户要求修改
    const rejectedState = await rejectAndRetry(state, '用户要求修改');
    const guidance = await generateStepGuidance(rejectedState);
    return {
      response: `已打回重新执行。\n\n${guidance}`,
      state: rejectedState,
      action: 'rejected',
    };
  }

  // 8. 流程已完成
  if (state.status === 'completed') {
    if (/^是$|^yes$/i.test(userMessage.trim())) {
      // TODO: 调用写作 Agent 生成最终输出
      return {
        response: '正在生成最终输出...\n\n[此功能待实现：调用写作 Agent 生成论文/报告]',
        state,
        action: 'none',
      };
    }
    return {
      response: '流程已结束。如需开始新任务，请发送新的研究任务。',
      state: null,
      action: 'none',
    };
  }

  // 默认：生成引导
  const guidance = await generateStepGuidance(state);
  return {
    response: guidance,
    state,
    action: 'continued',
  };
}

/**
 * 检查是否应该触发 SOP 流程
 */
export async function shouldTriggerSop(userMessage: string): Promise<boolean> {
  const analysis = await aiAnalyzeTask(userMessage);
  return analysis.isAcademicTask;
}
