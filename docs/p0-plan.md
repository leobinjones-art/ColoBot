# P0 开发计划

> 更新日期: 2026-04-15
> 目标: 完成 MiniMax Coding Plan 全模态能力接入

## 目标

ColoBot 使用 MiniMax Coding Plan，需全面接入以下能力：

- [x] 图片生成 (image-01)
- [x] 视觉理解 (coding-plan-vlm) ✅
- [x] 搜索 (coding-plan-search) ✅
- [x] TTS HD (speech-2.8-hd) ✅
- [ ] 音乐生成 (music-2.6)
- [ ] 视频生成 (Hailuo-2.3)

## P0 完成状态

### ✅ P0-1: vision（视觉理解）

**工具名**: `vision`
**API**: `https://api.minimaxi.com/v1/coding_plan_vlm`
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P0-2: minimax_search（搜索）

**工具名**: `minimax_search`（避免与 SearXNG 的 web_search 重名）
**API**: `https://api.minimaxi.com/v1/coding_plan_search`
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P0-3: speak（TTS HD）

**工具名**: `speak`
**API**: `https://api.minimaxi.com/v1/t2a_v2`
**模型**: speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo / speech-02-hd / speech-02-turbo 等
**文件**: `src/agent-runtime/tools/executor.ts`

---

## 前端对话界面（待定）

用户正在考虑是否增加前端对话 UI。

**方案 A: 自建 Web UI**
- React/Vue 单页应用
- WebSocket 实时通信
- 对接现有 `/api/chat` 端点

**方案 B: 接入现有 Chat UI**
- 如 Chatbot UI / Open WebUI
- 通过 API 对接

**方案 C: 暂不做**
- 当前通过 API / WebSocket 集成即可满足需求

---

## 实施顺序

1. [x] coding-plan-vlm ✅
2. [x] coding-plan-search ✅
3. [x] TTS HD ✅
4. [ ] 音乐生成 (P1)
5. [ ] 视频生成 (P1)
6. [ ] (前端 UI 待决策)
