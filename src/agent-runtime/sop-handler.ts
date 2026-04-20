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
  saveSopState,
  generateStepGuidance,
  submitUserData,
  aiReviewSubAgentOutput,
  approveAndAdvance,
  rejectAndRetry,
  confirmTaskBreakdown,
  cancelSop,
  pauseSop,
  resumeSop,
  restartStep,
  detectExitIntent,
  detectPauseIntent,
  detectResumeIntent,
  detectRestartIntent,
  detectConfirmation,
  detectModification,
  detectListIntent,
  detectNewSopIntent,
  detectTaskSelection,
  detectResearchPurpose,
  formatSopStatus,
  formatTaskBreakdown,
  formatSopList,
  summarizeSubAgentResult,
  type SopState,
  type TaskAnalysis,
} from './sop-v2.js';

export interface SopFlowResult {
  response: string;
  state: SopState | null;
  action: 'created' | 'continued' | 'confirmed' | 'submitted' | 'reviewed' | 'advanced' | 'rejected' | 'cancelled' | 'restarted' | 'paused' | 'resumed' | 'none';
}

/**
 * SOP 流程主入口
 */
export async function handleSopFlow(
  userMessage: string,
  agentId: string,
  sessionKey: string
): Promise<SopFlowResult> {
  console.log('[SOP Handler] Called with message:', userMessage.slice(0, 100));

  // 1. 检测退出意图（取消）
  if (detectExitIntent(userMessage)) {
    console.log('[SOP Handler] Exit intent detected');
    const state = await getActiveSopTask(agentId, sessionKey);
    if (state) {
      await cancelSop(state);
      return {
        response: '已取消 SOP 流程。如需继续，请重新发送任务。',
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

  // 2. 获取当前活跃任务（包括暂停状态）
  let state = await getActiveSopTask(agentId, sessionKey, true);
  console.log('[SOP Handler] Active task:', state ? `${state.taskName} (${state.status})` : 'none');

  // 3. 检测暂停意图
  if (detectPauseIntent(userMessage)) {
    console.log('[SOP Handler] Pause intent detected');
    if (state && state.status === 'active') {
      await pauseSop(state);
      return {
        response: `已暂停 SOP 流程。当前进度：步骤 ${state.currentStep}/${state.steps.length}\n\n发送"继续"恢复执行。`,
        state,
        action: 'paused',
      };
    }
    return {
      response: '当前没有进行中的 SOP 流程。',
      state: null,
      action: 'none',
    };
  }

  // 4. 检测恢复意图（显示列表让用户选择）
  if (detectResumeIntent(userMessage)) {
    console.log('[SOP Handler] Resume intent detected');
    const tasks = await listActiveSopTasks(agentId);

    // 如果有暂停的任务，直接恢复
    const pausedTask = tasks.find(t => t.status === 'paused');
    if (pausedTask) {
      state = await resumeSop(pausedTask);
      const guidance = await generateStepGuidance(state);
      return {
        response: `已恢复 SOP 流程。\n\n${guidance}`,
        state,
        action: 'resumed',
      };
    }

    // 否则显示所有任务列表
    return {
      response: formatSopList(tasks) + '\n\n发送任务编号继续对应任务，或发送新任务开始新流程。',
      state: null,
      action: 'none',
    };
  }

  // 5. 检测列表意图
  if (detectListIntent(userMessage)) {
    console.log('[SOP Handler] List intent detected');
    const tasks = await listActiveSopTasks(agentId);
    return {
      response: formatSopList(tasks) + '\n\n发送任务编号继续对应任务，或发送新任务开始新流程。',
      state: null,
      action: 'none',
    };
  }

  // 5.5 检测任务编号选择
  const taskIndex = detectTaskSelection(userMessage);
  if (taskIndex !== null && taskIndex > 0) {
    const tasks = await listActiveSopTasks(agentId);
    if (taskIndex <= tasks.length) {
      const selectedTask = tasks[taskIndex - 1];
      if (selectedTask.status === 'paused') {
        state = await resumeSop(selectedTask);
      } else {
        state = selectedTask;
      }
      const guidance = await generateStepGuidance(state);
      return {
        response: `已选择任务：**${state.taskName}**\n\n${guidance}`,
        state,
        action: 'resumed',
      };
    }
  }

  // 6. 检测重启意图
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

  // 7. 如果是暂停状态，不处理其他消息（除非是新建SOP）
  if (state?.status === 'paused' && !detectNewSopIntent(userMessage)) {
    return {
      response: 'SOP 流程已暂停。发送"继续"恢复执行，或"新建sop"开始新任务。',
      state,
      action: 'none',
    };
  }

  // 7.5 新建SOP意图 - 先取消当前任务
  if (detectNewSopIntent(userMessage) && state) {
    await cancelSop(state);
    state = null;
    console.log('[SOP Handler] Cancelled existing task for new SOP');
  }

  // 8. 无活跃任务，分析是否为新任务
  if (!state) {
    console.log('[SOP Handler] No active task, analyzing...');
    const analysis = await aiAnalyzeTask(userMessage);
    console.log('[SOP Handler] Analysis result:', analysis.isAcademicTask, analysis.taskType, analysis.researchPurpose);

    if (!analysis.isAcademicTask) {
      console.log('[SOP Handler] Not an academic task, skipping SOP');
      return {
        response: '',
        state: null,
        action: 'none',
      };
    }

    // 每任务必选研究目的
    if (!analysis.researchPurpose) {
      console.log('[SOP Handler] Research purpose not specified, asking user');
      // 保存临时分析结果，等待用户选择
      const tempState: SopState = {
        taskId: `temp-${Date.now()}`,
        sessionKey,
        agentId,
        taskName: analysis.taskName,
        taskSummary: userMessage,
        steps: analysis.suggestedSteps.map((s, i) => ({
          ...s,
          step: i + 1,
          status: i === 0 ? 'in_progress' : 'pending',
          userData: null,
          subAgentResult: null,
          approved: false,
          reviewNote: null,
          subAgentId: null,
        })),
        currentStep: 1,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        response: `检测到学术任务：**${analysis.taskName}**\n\n请选择您的研究目的：\n\n1. **写论文** - 发表期刊/毕业论文\n2. **做研究** - 科学研究、实验、分析\n3. **学习** - 学习某个领域的知识\n\n请回复数字或描述您的目的。`,
        state: tempState,
        action: 'created',
      };
    }

    // 创建新任务
    try {
      state = await createSop(agentId, sessionKey, analysis, userMessage);
      console.log('[SOP Handler] Created task:', state.taskId);
    } catch (e) {
      console.error('[SOP Handler] Failed to create task:', e);
      return {
        response: '',
        state: null,
        action: 'none',
      };
    }

    // 展示任务拆解结果
    const breakdown = formatTaskBreakdown(state);
    return {
      response: breakdown,
      state,
      action: 'created',
    };
  }

  // 5. 处理用户选择研究目的
  if (state && state.taskId.startsWith('temp-')) {
    const purpose = detectResearchPurpose(userMessage);
    if (purpose) {
      console.log('[SOP Handler] User selected purpose:', purpose);
      // 重新让AI根据目的生成步骤
      const purposeText = purpose === 'paper' ? '写论文' : purpose === 'research' ? '做研究' : '学习';
      const analysis = await aiAnalyzeTask(`${state.taskSummary}\n\n研究目的：${purposeText}`);
      if (analysis.isAcademicTask) {
        state = await createSop(agentId, sessionKey, analysis, state.taskSummary);
        const breakdown = formatTaskBreakdown(state);
        return {
          response: breakdown,
          state,
          action: 'created',
        };
      }
    }
  }

  // 6. 步骤1：任务拆解确认
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
    // 返回任务拆解结果，让用户确认（使用 action: 'continued' 避免LLM覆盖）
    const breakdown = formatTaskBreakdown(state);
    return {
      response: `${breakdown}\n\n请回复"确认"开始执行，或提出修改意见。`,
      state,
      action: 'continued',
    };
  }

  // 6. 中间步骤：用户提交数据
  const currentStep = state.steps[state.currentStep - 1];
  if (currentStep?.status === 'in_progress' && !currentStep.subAgentResult) {
    // 用户提交数据，子Agent处理
    const { state: newState, subAgentResult } = await submitUserData(state, userMessage);

    // 父Agent整理汇总子Agent结果
    const summarizedResult = await summarizeSubAgentResult(newState, subAgentResult);

    // AI 审核
    const review = await aiReviewSubAgentOutput(newState);

    if (review.approved) {
      // 审核通过，展示整理后的结果
      const status = formatSopStatus(newState);
      return {
        response: `${summarizedResult}\n\n---\n\n${status}\n\n回复"确认"继续下一步，或提出修改意见。`,
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

      // 展示新步骤的自动生成引导
      const newStep = state.steps[state.currentStep - 1];
      const status = formatSopStatus(state);
      return {
        response: `已进入步骤 ${state.currentStep}：**${newStep.name}**\n\n${newStep.subAgentResult || ''}\n\n---\n\n${status}\n\n回复"确认"继续下一步，或提出修改意见。`,
        state,
        action: 'advanced',
      };
    }

    // 用户提交新数据或请求帮助，重新执行当前步骤
    if (userMessage.length > 5) {
      // 用户提供了新内容，重新执行当前步骤
      currentStep.subAgentResult = null;
      currentStep.userData = userMessage;
      await saveSopState(state);

      // 重新执行子Agent
      const { state: newState, subAgentResult } = await submitUserData(state, userMessage);
      const summarizedResult = await summarizeSubAgentResult(newState, subAgentResult);
      const status = formatSopStatus(newState);

      return {
        response: `${summarizedResult}\n\n---\n\n${status}\n\n回复"确认"继续下一步，或提出修改意见。`,
        state: newState,
        action: 'submitted',
      };
    }

    // 短消息当作修改请求
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
