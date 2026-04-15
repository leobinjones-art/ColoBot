# P0 / P1 开发计划

> 更新日期: 2026-04-15
> 目标: 完成 MiniMax Coding Plan 全模态能力接入

## 目标

ColoBot 使用 MiniMax Coding Plan，需全面接入以下能力：

- [x] 图片生成 (image-01)
- [x] 视觉理解 (coding-plan-vlm) ✅
- [x] 搜索 (coding-plan-search) ✅
- [x] TTS HD (speech-2.8-hd) ✅
- [x] 音乐生成 (music-2.6) ✅
- [x] 视频生成 (Hailuo-2.3) ✅

## P0 完成状态

### ✅ P0-1: vision（视觉理解）

**工具名**: `vision`
**API**: `https://api.minimaxi.com/v1/coding_plan/vlm`
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P0-2: minimax_search（搜索）

**工具名**: `minimax_search`（避免与 SearXNG 的 web_search 重名）
**API**: `https://api.minimaxi.com/v1/coding_plan/search`
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P0-3: speak（TTS HD）

**工具名**: `speak`
**API**: `https://api.minimaxi.com/v1/t2a_v2`
**模型**: speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo / speech-02-hd / speech-02-turbo 等
**文件**: `src/agent-runtime/tools/executor.ts`

## P1 完成状态

### ✅ P1-1: generate_music（音乐生成）

**工具名**: `generate_music`
**API**: `https://api.minimaxi.com/v1/music_generation`
**模型**: music-2.6-free / music-2.6 / music-2.5+ / music-2.5
**参数**: prompt / lyrics / instrumental / lyrics_optimizer / vocals / genre / mood 等
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P1-2: generate_music_cover（音乐翻唱）

**工具名**: `generate_music_cover`
**API**: `https://api.minimaxi.com/v1/music_cover`
**模型**: music-cover / music-cover-free
**参数**: prompt / audio_url / lyrics / seed
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P1-3: generate_video（视频生成）

**工具名**: `generate_video`
**API**: `https://api.minimaxi.com/v1/video_generation`
**模型**: MiniMax-Hailuo-2.3 / MiniMax-Hailuo-02 / S2V-01 / I2V-01
**流程**: 创建任务 → 轮询状态 → 获取下载链接（自动完成，最长 5 分钟）
**参数**: prompt / model / first_frame_image / last_frame_image / subject_image
**文件**: `src/agent-runtime/tools/executor.ts`

### ✅ P1-4: query_video_task（查询视频任务）

**工具名**: `query_video_task`
**API**: `https://api.minimaxi.com/v1/query/video_generation`
**用途**: 查询视频生成状态，返回 download_url
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
4. [x] 音乐生成 (music-2.6) ✅
5. [x] 视频生成 (Hailuo-2.3) ✅
6. [ ] (前端 UI 待决策)
