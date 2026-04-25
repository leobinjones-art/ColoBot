/**
 * SOP 相关类型
 */

import type { SubAgentType, SubAgentConfig } from './agent.js';

// SOP 步骤
export interface SopStep {
  id: string;
  name: string;
  description: string;
  type: SubAgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// SOP 状态
export interface SopState {
  id: string;
  agentId: string;
  taskName: string;
  taskDescription: string;
  steps: SopStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// 任务分析结果
export interface TaskAnalysis {
  taskName: string;
  taskDescription: string;
  complexity: 'low' | 'medium' | 'high';
  suggestedSteps: string[];
  requiredTools: string[];
}

// SOP 提示名称
export type SopPromptName = 'taskAnalysis' | 'stepGuidance' | 'summarizeSubAgent' | 'reviewStep' | 'finalOutput';

// 重新导出
export type { SubAgentType, SubAgentConfig };
