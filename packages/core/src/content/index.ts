/**
 * Content 模块导出
 */

export { ContentScanner, detectThreat, buildUninstallConfirmPrompt, type ScanResult, type ContentScannerConfig, type ThreatResult } from './scanner.js';
export {
  determineTrustLevel,
  canWrite,
  validateContent,
  detectPoisoning,
  recordPoisoningAttempt,
  type ContentSource,
  type ContentValidationResult,
  type PoisoningAttempt,
} from './poison-defense.js';
