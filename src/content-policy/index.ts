/**
 * 内容策略 - 入口模块
 *
 * 注意：SOP 流程已移至 sop-v2.ts 和 sop-handler.ts
 * 此文件仅保留内容安全检测功能
 */

export { scanInput, scanOutput } from './guard.js';
export { detectThreat, buildUninstallConfirmPrompt } from './threat.js';
