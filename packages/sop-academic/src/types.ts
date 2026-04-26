/**
 * SOP 学术研究流程 - 类型定义
 */

export interface SopStep {
  step: number;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  userData: string | null;
  subAgentResult: string | null;
  approved: boolean;
  reviewNote: string | null;
  subAgentId: string | null;
}

export interface SopState {
  taskId: string;
  sessionKey: string;
  agentId: string;
  taskName: string;
  taskSummary: string;
  steps: SopStep[];
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  researchPurpose?: 'paper' | 'research' | 'learning';
  createdAt: string;
  updatedAt: string;
}

export interface TaskAnalysis {
  isAcademicTask: boolean;
  taskType: string;
  taskName: string;
  suggestedSteps: Array<{ name: string; description?: string }>;
  informationComplete: boolean;
  missingInfo: string[];
  researchPurpose?: 'paper' | 'research' | 'learning';
}

export interface SopConfig {
  maxSteps?: number;
  defaultTtlMs?: number;
  languages?: ('zh' | 'en')[];
}

export type SopAction =
  | 'created'
  | 'continued'
  | 'confirmed'
  | 'submitted'
  | 'reviewed'
  | 'advanced'
  | 'rejected'
  | 'cancelled'
  | 'restarted'
  | 'paused'
  | 'resumed'
  | 'none';

export interface SopResult {
  response: string;
  state: SopState | null;
  action: SopAction;
}