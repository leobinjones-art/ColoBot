/**
 * SOP 学术研究流程引擎
 *
 * 通过 ColoBotRuntime 接口使用 core 能力
 */

import type { ColoBotRuntime } from '@colobot/core';
import type { SopState, SopStep, TaskAnalysis, SopResult, SopAction, SopConfig } from './types.js';
import { SOP_PROMPTS, fillPrompt } from './prompts.js';

const SOP_NAMESPACE = 'sop-academic';
const DEFAULT_CONFIG: SopConfig = {
  maxSteps: 10,
  defaultTtlMs: 300000,
};

export class SopEngine {
  private config: SopConfig;

  constructor(
    private runtime: ColoBotRuntime,
    config?: Partial<SopConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // === 状态管理 ===

  private stateKey(agentId: string, taskId: string): string {
    return `${agentId}:${taskId}`;
  }

  async saveState(state: SopState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.runtime.saveState(SOP_NAMESPACE, this.stateKey(state.agentId, state.taskId), state);
  }

  async loadState(agentId: string, taskId: string): Promise<SopState | null> {
    const state = await this.runtime.loadState(SOP_NAMESPACE, this.stateKey(agentId, taskId));
    return state as SopState | null;
  }

  async getActiveTask(agentId: string, sessionKey: string): Promise<SopState | null> {
    const key = `active:${agentId}:${sessionKey}`;
    const taskId = await this.runtime.loadState(SOP_NAMESPACE, key);
    if (typeof taskId === 'string') {
      return this.loadState(agentId, taskId);
    }
    return null;
  }

  async listActiveTasks(agentId: string): Promise<SopState[]> {
    const states = await this.runtime.listStates(SOP_NAMESPACE, { limit: 50 });
    return (states as SopState[]).filter(s =>
      s.agentId === agentId && (s.status === 'active' || s.status === 'paused')
    );
  }

  // === AI 分析 ===

  async analyzeTask(userMessage: string): Promise<TaskAnalysis> {
    const prompt = fillPrompt(SOP_PROMPTS.taskAnalysis, { userMessage: userMessage.slice(0, 4000) });
    const response = await this.runtime.chat(prompt, { temperature: 0.3 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TaskAnalysis;
      }
    } catch (e) {
      console.error('[SOP] Failed to parse analysis:', e);
    }

    return {
      isAcademicTask: false,
      taskType: 'none',
      taskName: '',
      suggestedSteps: [],
      informationComplete: false,
      missingInfo: [],
    };
  }

  // === 流程控制 ===

  async createTask(
    agentId: string,
    sessionKey: string,
    analysis: TaskAnalysis,
    userMessage: string
  ): Promise<SopState> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const steps: SopStep[] = analysis.suggestedSteps.map((s, i) => ({
      step: i + 1,
      name: s.name,
      description: s.description,
      status: i === 0 ? 'in_progress' : 'pending',
      userData: null,
      subAgentResult: null,
      approved: false,
      reviewNote: null,
      subAgentId: null,
    }));

    const state: SopState = {
      taskId,
      sessionKey,
      agentId,
      taskName: analysis.taskName,
      taskSummary: userMessage.slice(0, 500),
      steps,
      currentStep: 1,
      status: 'active',
      researchPurpose: analysis.researchPurpose,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveState(state);
    await this.runtime.saveState(SOP_NAMESPACE, `active:${agentId}:${sessionKey}`, taskId);

    return state;
  }

  async confirmBreakdown(state: SopState): Promise<SopState> {
    const step1 = state.steps[0];
    if (step1) {
      step1.status = 'done';
      step1.approved = true;
      step1.userData = '用户已确认任务拆解';

      if (state.steps.length > 1) {
        state.currentStep = 2;
        state.steps[1].status = 'in_progress';
      } else {
        state.status = 'completed';
      }
    }

    await this.saveState(state);
    return state;
  }

  async submitStepData(state: SopState, userData: string): Promise<SopState> {
    const currentStep = state.steps[state.currentStep - 1];
    if (!currentStep) return state;

    currentStep.userData = userData;

    // 创建子 Agent 处理
    const agentId = await this.runtime.createAgent({
      name: `${currentStep.name}-agent`,
      soul: `你是${currentStep.name}助手，负责处理学术研究流程中的${currentStep.name}任务。`,
      tools: ['search', 'read_file', 'write_file'],
      ttlMs: this.config.defaultTtlMs,
    });

    currentStep.subAgentId = agentId;

    // 执行子任务
    const task = `任务：${state.taskName}\n步骤：${currentStep.name}\n描述：${currentStep.description || '无'}\n用户输入：${userData}`;
    const result = await this.runtime.runAgent(agentId, task);
    currentStep.subAgentResult = result;

    await this.saveState(state);
    return state;
  }

  async reviewStep(state: SopState): Promise<{ approved: boolean; reason?: string }> {
    const currentStep = state.steps[state.currentStep - 1];
    if (!currentStep || !currentStep.subAgentResult) {
      return { approved: false, reason: '没有待审核的内容' };
    }

    const prompt = fillPrompt(SOP_PROMPTS.review, {
      taskName: state.taskName,
      stepNumber: currentStep.step,
      totalSteps: state.steps.length,
      stepName: currentStep.name,
      userData: currentStep.userData?.slice(0, 1000) || '无',
      subAgentResult: currentStep.subAgentResult.slice(0, 2000),
    });

    const response = await this.runtime.chat(prompt, { temperature: 0.3 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[SOP] Failed to parse review:', e);
    }

    return { approved: true };
  }

  async advanceStep(state: SopState): Promise<SopState> {
    const currentStep = state.steps[state.currentStep - 1];
    if (!currentStep) return state;

    currentStep.status = 'done';
    currentStep.approved = true;

    // 销毁子 Agent
    if (currentStep.subAgentId) {
      await this.runtime.destroyAgent(currentStep.subAgentId);
      currentStep.subAgentId = null;
    }

    // 推进到下一步
    if (state.currentStep < state.steps.length) {
      state.currentStep += 1;
      state.steps[state.currentStep - 1].status = 'in_progress';
    } else {
      state.status = 'completed';
    }

    await this.saveState(state);
    return state;
  }

  async pauseTask(state: SopState): Promise<SopState> {
    state.status = 'paused';
    const currentStep = state.steps[state.currentStep - 1];
    if (currentStep?.subAgentId) {
      await this.runtime.destroyAgent(currentStep.subAgentId);
      currentStep.subAgentId = null;
    }
    await this.saveState(state);
    return state;
  }

  async resumeTask(state: SopState): Promise<SopState> {
    if (state.status !== 'paused') return state;
    state.status = 'active';
    await this.saveState(state);
    return state;
  }

  async cancelTask(state: SopState): Promise<void> {
    state.status = 'cancelled';
    for (const step of state.steps) {
      if (step.subAgentId) {
        await this.runtime.destroyAgent(step.subAgentId);
      }
    }
    await this.saveState(state);
  }

  async generateFinalOutput(state: SopState): Promise<string> {
    const stepSummaries = state.steps
      .filter(s => s.subAgentResult)
      .map(s => `## ${s.name}\n\n${s.subAgentResult!.slice(0, 2000)}`)
      .join('\n\n---\n\n');

    const prompt = fillPrompt(SOP_PROMPTS.finalOutput, {
      taskName: state.taskName,
      taskSummary: state.taskSummary,
      stepSummaries,
    });

    const result = await this.runtime.chat(prompt, { maxTokens: 4000 });

    // 保存到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `research-report-${timestamp}.md`;
    await this.runtime.writeFile(`${state.agentId}/${fileName}`, result);

    return result;
  }

  // === 引导生成 ===

  async generateGuidance(state: SopState): Promise<string> {
    const currentStep = state.steps[state.currentStep - 1];
    if (!currentStep) return '流程已完成。';

    const completedSteps = state.steps
      .filter(s => s.status === 'done')
      .map(s => `- ${s.name}`)
      .join('\n') || '无';

    const prompt = fillPrompt(SOP_PROMPTS.stepGuidance, {
      taskName: state.taskName,
      stepNumber: currentStep.step,
      totalSteps: state.steps.length,
      stepName: currentStep.name,
      stepDescription: currentStep.description || '无',
      completedSteps,
    });

    return this.runtime.chat(prompt, { maxTokens: 200 });
  }
}
