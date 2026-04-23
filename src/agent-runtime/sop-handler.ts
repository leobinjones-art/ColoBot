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
  // 用户偏好与优化
  applyUserPreference,
  recordPurposeSelection,
  recordModification,
  recordStepMetrics,
  generateOptimizationReport,
  // 最终输出生成
  generateFinalOutput,
  // AI 动态响应
  generateSopResponse,
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
      const response = await generateSopResponse({ type: 'cancelled', state, userMessage });
      return { response, state: null, action: 'cancelled' };
    }
    const response = await generateSopResponse({ type: 'no_active_task', userMessage });
    return { response, state: null, action: 'none' };
  }

  // 1.5 检测优化报告请求
  if (/sop优化报告|优化建议|流程优化|sop optimization|optimization report/i.test(userMessage)) {
    const report = await generateOptimizationReport(agentId);
    return { response: report, state: null, action: 'none' };
  }

  // 2. 获取当前活跃任务（包括暂停状态和完成状态）
  let state = await getActiveSopTask(agentId, sessionKey, true, true);
  console.log('[SOP Handler] Active task:', state ? `${state.taskName} (${state.status})` : 'none');

  // 2.5 如果是完成状态，直接处理最终输出
  if (state?.status === 'completed') {
    if (/^是$|^yes$/i.test(userMessage.trim())) {
      const result = await generateFinalOutput(state);
      if (result.success) {
        const fileName = result.filePath?.split('/').pop();
        const downloadUrl = fileName ? `/api/files/${state.agentId}/${fileName}` : undefined;
        const response = await generateSopResponse({
          type: 'final_output_generated',
          state,
          result: result.content,
          filePath: result.filePath,
          downloadUrl,
          userMessage,
        });
        return { response, state, action: 'reviewed' };
      } else {
        const response = await generateSopResponse({
          type: 'final_output_generated',
          state,
          reason: result.content,
          userMessage,
        });
        return { response, state, action: 'reviewed' };
      }
    }
    if (/^否$|^no$/i.test(userMessage.trim())) {
      const response = await generateSopResponse({ type: 'cancelled', userMessage });
      return { response, state: null, action: 'cancelled' };
    }
    // 其他消息，提示用户
    const response = await generateSopResponse({ type: 'final_output_ready', state, userMessage });
    return { response, state, action: 'none' };
  }

  // 3. 检测暂停意图
  if (detectPauseIntent(userMessage)) {
    console.log('[SOP Handler] Pause intent detected');
    if (state && state.status === 'active') {
      await pauseSop(state);
      const response = await generateSopResponse({
        type: 'paused',
        state,
        currentStep: state.currentStep,
        totalSteps: state.steps.length,
        userMessage,
      });
      return { response, state, action: 'paused' };
    }
    const response = await generateSopResponse({ type: 'no_active_task', userMessage });
    return { response, state: null, action: 'none' };
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
      const response = await generateSopResponse({
        type: 'resumed',
        state,
        currentStep: state.currentStep,
        totalSteps: state.steps.length,
        userMessage,
      });
      return { response: `${response}\n\n${guidance}`, state, action: 'resumed' };
    }

    // 否则显示所有任务列表
    const response = await generateSopResponse({ type: 'task_list', tasks, userMessage });
    return { response, state: null, action: 'none' };
  }

  // 5. 检测列表意图
  if (detectListIntent(userMessage)) {
    console.log('[SOP Handler] List intent detected');
    const tasks = await listActiveSopTasks(agentId);
    const response = await generateSopResponse({ type: 'task_list', tasks, userMessage });
    return { response, state: null, action: 'none' };
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
      const response = await generateSopResponse({
        type: 'resumed',
        state,
        taskName: state.taskName,
        userMessage,
      });
      return { response: `${response}\n\n${guidance}`, state, action: 'resumed' };
    }
  }

  // 6. 检测重启意图
  const restartStepNum = detectRestartIntent(userMessage);
  if (restartStepNum !== null && state) {
    state = await restartStep(state, restartStepNum);
    const guidance = await generateStepGuidance(state);
    const response = await generateSopResponse({
      type: 'restarted',
      state,
      currentStep: restartStepNum,
      userMessage,
    });
    return { response: `${response}\n\n${guidance}`, state, action: 'restarted' };
  }

  // 7. 如果是暂停状态，不处理其他消息（除非是新建SOP）
  if (state?.status === 'paused' && !detectNewSopIntent(userMessage)) {
    const response = await generateSopResponse({ type: 'paused', state, userMessage });
    return { response, state, action: 'none' };
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
    let analysis = await aiAnalyzeTask(userMessage);

    // 应用用户偏好
    analysis = await applyUserPreference(agentId, analysis);

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
      const response = await generateSopResponse({
        type: 'purpose_selection',
        taskName: analysis.taskName,
        userMessage,
      });
      return { response, state: tempState, action: 'created' };
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
    const breakdown = await formatTaskBreakdown(state);
    return { response: breakdown, state, action: 'created' };
  }

  // 5. 处理用户选择研究目的
  if (state && state.taskId.startsWith('temp-')) {
    const purpose = detectResearchPurpose(userMessage);
    if (purpose) {
      console.log('[SOP Handler] User selected purpose:', purpose);
      // 记录用户偏好
      await recordPurposeSelection(agentId, purpose);
      // 重新让AI根据目的生成步骤
      const purposeText = purpose === 'paper' ? '写论文' : purpose === 'research' ? '做研究' : '学习';
      const analysis = await aiAnalyzeTask(`${state.taskSummary}\n\n研究目的：${purposeText}`);
      if (analysis.isAcademicTask) {
        state = await createSop(agentId, sessionKey, analysis, state.taskSummary);
        const breakdown = await formatTaskBreakdown(state);
        return { response: breakdown, state, action: 'created' };
      }
    }
  }

  // 6. 步骤1：任务拆解确认
  if (state.currentStep === 1 && state.steps[0]?.status === 'in_progress') {
    // 检测修改意图
    if (detectModification(userMessage)) {
      // 记录修改意见
      await recordModification(agentId, userMessage);
      // 重新分析并拆解，使用原始任务摘要 + 用户修改意见
      const analysis = await aiAnalyzeTask(state.taskSummary + '\n\n用户修改意见：' + userMessage);
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
        return { response: await formatTaskBreakdown(state), state, action: 'created' };
      }
    }

    // 检测确认
    if (detectConfirmation(userMessage)) {
      state = await confirmTaskBreakdown(state, true);
      const guidance = await generateStepGuidance(state);
      const response = await generateSopResponse({ type: 'breakdown_confirm', state, userMessage });
      return { response: `${response}\n\n${guidance}`, state, action: 'confirmed' };
    }

    // 用户未确认，继续等待确认
    const breakdown = await formatTaskBreakdown(state);
    const response = await generateSopResponse({ type: 'breakdown_confirm', state, userMessage });
    return { response: `${breakdown}\n\n${response}`, state, action: 'continued' };
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
      const status = await formatSopStatus(newState);
      const response = await generateSopResponse({
        type: 'step_submitted',
        state: newState,
        result: summarizedResult,
        userMessage,
      });
      return { response: `${summarizedResult}\n\n---\n\n${status}\n\n${response}`, state: newState, action: 'submitted' };
    } else {
      // 审核打回，记录指标
      await recordStepMetrics(agentId, state.taskId, state.currentStep, currentStep.name, true, 0, review.reason);
      const rejectedState = await rejectAndRetry(newState, review.reason);
      const response = await generateSopResponse({
        type: 'step_rejected',
        state: rejectedState,
        reason: review.reason,
        suggestions: review.suggestions,
        userMessage,
      });
      return { response, state: rejectedState, action: 'rejected' };
    }
  }

  // 7. 等待用户确认审核结果
  if (currentStep?.subAgentResult && !currentStep.approved) {
    if (detectConfirmation(userMessage)) {
      // 记录步骤通过指标
      await recordStepMetrics(agentId, state.taskId, state.currentStep, currentStep.name, false, 0);

      state = await approveAndAdvance(state);

      if (state.status === 'completed') {
        const response = await generateSopResponse({ type: 'final_output_ready', state, userMessage });
        return { response, state, action: 'advanced' };
      }

      // 展示新步骤的自动生成引导
      const newStep = state.steps[state.currentStep - 1];
      const status = await formatSopStatus(state);
      const response = await generateSopResponse({
        type: 'step_advanced',
        state,
        currentStep: state.currentStep,
        totalSteps: state.steps.length,
        stepName: newStep.name,
        userMessage,
      });
      return { response: `${response}\n\n${newStep.subAgentResult || ''}\n\n---\n\n${status}`, state, action: 'advanced' };
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
      const status = await formatSopStatus(newState);
      const response = await generateSopResponse({ type: 'step_submitted', state: newState, result: summarizedResult, userMessage });
      return { response: `${summarizedResult}\n\n---\n\n${status}\n\n${response}`, state: newState, action: 'submitted' };
    }

    // 短消息当作修改请求
    const rejectedState = await rejectAndRetry(state, 'User requested modification');
    const guidance = await generateStepGuidance(rejectedState);
    const response = await generateSopResponse({ type: 'step_rejected', state: rejectedState, reason: 'User requested modification', userMessage });
    return { response: `${response}\n\n${guidance}`, state: rejectedState, action: 'rejected' };
  }

  // 默认：生成引导
  const guidance = await generateStepGuidance(state);
  return { response: guidance, state, action: 'continued' };
}

/**
 * 检查是否应该触发 SOP 流程
 */
export async function shouldTriggerSop(userMessage: string): Promise<boolean> {
  const analysis = await aiAnalyzeTask(userMessage);
  return analysis.isAcademicTask;
}
