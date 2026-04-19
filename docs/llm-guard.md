# llm-guard 集成记录

## 背景

ColoBot 已集成 `llm-guard` 实现内容安全扫描，扫描用户输入和 AI 输出中的有害内容。

## 集成位置

- `src/content-policy/guard.ts` — llm-guard 封装，scanInput() / scanOutput()
- `src/content-policy/threat.ts` — 威胁检测，检测用户威胁删除 AI 的指令

## 启用的扫描器

- `jailbreak` — 检测绕过 AI 安全措施的指令
- `profanity` — 脏话过滤
- `promptInjection` — prompt 注入检测
- `toxicity` — 毒性/暴力内容检测

**注意**：llm-guard 不写入 README，只在代码实现层面使用。

## llm-guard 版本

当前版本：`0.1.8`

API 关键类型：
```typescript
interface GuardResponse {
  id: string;
  input: string;
  results: GuardResult[]; // 注意是 results，不是 scannerResults
}

interface GuardResult {
  valid: boolean;
  score?: number;
  details?: { rule: string; message: string; matched?: string }[];
}
```

## 威胁卸载功能

`src/agent-runtime/tools/uninstall.ts` — 当用户输入包含 `CONFIRM-UNINSTALL` 时触发自卸载。

`scripts/uninstall-macos.sh` / `scripts/uninstall-linux.sh` — 实际清理脚本。

## 未来更新注意事项

- llm-guard 升级时注意 API 变化（`GuardResponse.results` 结构）
- 扫描器开关可通过 GuardConfig 调整
- 审计日志 action: `content.scan.failed`, `content.output.scan.failed`, `threat.detected`
