# MiniMax 全模态能力覆盖文档

> 更新日期: 2026-04-15
> 基于 [MiniMax Platform API 文档](https://platform.minimaxi.com/docs/llms.txt)

## 现状总览

| 模态 | 能力 | 状态 | 实现方式 |
|------|------|------|----------|
| **文本生成** | M2.7 / M2.5 / M2.1 / M2 | ✅ 已支持 | `src/llm/index.ts` |
| **图片生成** | image-01 | ✅ 已支持 | `generate_image` 工具 |
| **TTS 语音合成** | speech-2.8-hd / 2.6 系列 | ✅ 已支持 | `speak` 工具 |
| **音乐生成** | music-2.6 / music-cover / lyrics_generation | ❌ 未接 | — |
| **文生视频** | Hailuo-2.3 / 02 | ❌ 未接 | — |
| **图生视频** | Hailuo-2.3-Fast | ❌ 未接 | — |
| **视觉理解** | coding-plan-vlm | ✅ 已支持 | `vision` 工具 |
| **搜索** | coding-plan-search | ✅ 已支持 | `minimax_search` 工具 |

---

## 已实现详情

### 文本生成 (`src/llm/index.ts`)

**基础 URL**: `https://api.minimax.chat/v1/text/chatcompletion_v2`

| 模型 | Token | 速度 | 说明 |
|------|-------|------|------|
| MiniMax-M2.7 | 204800 | ~60 tps | 开启自我迭代 |
| MiniMax-M2.7-highspeed | 204800 | ~100 tps | 极速版 |
| MiniMax-M2.5 | 204800 | ~60 tps | 顶尖性能+性价比 |
| MiniMax-M2.5-highspeed | 204800 | ~100 tps | 极速版 |
| MiniMax-M2.1 | 204800 | ~60 tps | 强大编程能力 |
| MiniMax-M2.1-highspeed | 204800 | ~100 tps | 极速版 |
| MiniMax-M2 | 204800 | — | Agent 工作流专用 |

**接入方式**: OpenAI SDK 兼容，HTTP API

---

### 图片生成 (`generate_image` 工具)

**基础 URL**: `https://api.minimaxi.com/v1/image_generation`

| 模型 | 说明 |
|------|------|
| image-01 | 文生图 + 图生图（人物主体参考） |
| image-01-live | image-01 基础上支持多种画风设置 |

**工具调用参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | string | `image-01` | 模型选择 |
| `prompt` | string | (必填) | 文本描述，最长 1500 字符 |
| `subject_reference` | array | — | 图生图，`[{type:"character", image_file:"url或base64"}]` |
| `style` | object | — | 仅 `image-01-live` 支持 |
| `aspect_ratio` | string | `1:1` | 1:1 16:9 4:3 3:2 2:3 3:4 9:16 21:9 |
| `width` / `height` | number | — | 仅 image-01，512-2048，需同时设 |
| `response_format` | string | `url` | `url` 或 `base64` |
| `seed` | number | — | 随机种子，可复现 |
| `n` | number | 1 | 1-9 张 |
| `prompt_optimizer` | boolean | false | 自动优化 prompt |
| `aigc_watermark` | boolean | false | 添加水印 |

**返回格式**:
```json
{
  "images": ["https://..."],
  "metadata": { "success_count": 2, "failed_count": 0 },
  "id": "task-xxx"
}
```

---

## 待接入清单

### P0 — 高价值，低复杂度

#### 1. coding-plan-vlm（视觉理解）

让 Agent 能看懂用户上传的图片/截图，对编程和分析场景极有价值。

**建议工具名**: `describe_image` / `vision`

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 要问图片的问题 |
| `image_source` | string | 图片 URL 或 base64 |

---

#### 2. coding-plan-search（搜索）

MiniMax 官方搜索 API，可替代或增强 SearXNG。

**建议工具名**: `web_search`

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `query` | string | 搜索词（支持 Google 高级语法） |

---

#### 3. TTS HD（语音合成）

**基础 URL**: `https://api.minimaxi.com/v1/t2a_v2`

**模型**: speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo

**建议工具名**: `speak` / `text_to_speech`

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | string | 待合成文本，最长 10000 字符 |
| `model` | string | speech-2.8-hd 等 |
| `voice_id` | string | 音色 ID |
| `speed` | number | 语速 |
| `format` | string | mp3 / pcm / flac / wav |
| `stream` | boolean | 流式输出 |

---

### P1 — 中等价值

#### 4. 音乐生成

**基础 URL**: `https://api.minimaxi.com/v1/music_generation`

**模型**: music-2.6

**建议工具名**: `generate_music`

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 歌曲描述/灵感 |
| `lyrics` | string | 歌词（可选） |
| `lyrics_optimizer` | boolean | 自动生成歌词 |
| `instrumental` | boolean | 纯器乐 |

**music-cover**（参考音频生成翻唱版）:
**基础 URL**: `https://api.minimaxi.com/v1/music_cover`

| 参数 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 描述翻唱风格 |
| `audio_file` | string | 参考音频 URL 或 base64 |

---

#### 5. 视频生成（文生视频 / 图生视频）

**基础 URL**: `https://api.minimaxi.com/v1/video_generation`

**模型**: Hailuo-2.3 / Hailuo-2.3-Fast / Hailuo-02

**流程**（异步三步曲）:
1. 创建任务 → 获取 `task_id`
2. 查询状态 → 状态成功时获取 `file_id`
3. 文件管理接口 → 下载/查看结果

**建议工具名**: `generate_video`

---

### P2 — 低优先级

#### 6. 异步长文本 TTS

单次最大 100 万字符，适合整本书籍。

#### 7. 音色克隆

需个人认证 + 企业认证，复刻音色临时 168h。

#### 8. 视频 Agent

预制模板（跳水/labubu 等），娱乐向。

---

## 附录

### 支持语言（40 种）

中文、粤语、英语、西班牙语、法语、俄语、德语、葡萄牙语、阿拉伯语、意大利语、日语、韩语、印尼语、越南语、土耳其语、荷兰语、乌克兰语、泰语、波兰语、罗马尼亚语、希腊语、捷克语、芬兰语、印地语、保加利亚语、丹麦语、希伯来语、马来语、波斯语、斯洛伐克语、瑞典语、克罗地亚语、菲律宾语、匈牙利语、挪威语、斯洛文尼亚语、加泰罗尼亚语、尼诺斯克语、泰米尔语、阿非利卡语

### API Key 说明

- **按量付费**: [platform.minimaxi.com](https://platform.minimaxi.com/user-center/basic-information/interface-key) 创建 API Key，支持所有模态
- **Token Plan**: 专门给 MiniMax 全模态模型用

### ⚠️ 重要：API Host 与套餐关联

**ColoBot 用户使用的是 Coding Plan（Token Plan）套餐**。

| 套餐类型 | API Host | 说明 |
|----------|----------|------|
| **Coding Plan (Token Plan)** | `api.minimaxi.com` | 当前使用，Token Plan 专用 |
| 按量付费（标准） | `api.minimax.chat` | 标准接口 |

> `api.minimax.chat` 和 `api.minimaxi.com` **不是同一个域名**，接错会报 `Invalid API key`。

**各模态 API Host（当前配置）**:

| 模态 | Coding Plan Host |
|------|-----------------|
| 文本生成 | `api.minimax.chat` 或 `api.minimaxi.com` |
| 图片/视频/TTS/音乐 | `api.minimaxi.com` |

> ⚠️ Coding Plan 的 API Key 对应 `api.minimaxi.com`，文本接口可能也需用此 host。

---

### 官方 MCP（参考实现）

[MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP)（Python）和 [MiniMax-MCP-JS](https://github.com/MiniMax-AI/MiniMax-MCP-JS)（TypeScript）是官方参考实现，ColoBot 的工具可对照其工具定义。

**MCP 暴露的工具清单**（参考 Python 版 `server.py`）:

| 工具名 | 功能 | 对应 API |
|--------|------|----------|
| `list_voices` | 列出可用音色 | TTS |
| `voice_clone` | 音色克隆 | 复刻音色接口 |
| `generate_video` | 视频生成 | `/v1/video_generation` |
| `query_video_generation` | 查询视频任务状态 | 异步三步曲 |
| `text_to_image` | 图片生成 | `/v1/image_generation` |
| `music_generation` | 音乐生成 | `/v1/music_generation` |
| `voice_design` | 音色设计（prompt 生成音色） | `/v1/voice_design/design` |

---

### MiniMax 全产品线开源项目详解

#### 核心模型类

**1. [MiniMax-01](https://github.com/MiniMax-AI/MiniMax-01)**
`Text-01` + `VL-01` 模型官方仓库，基于 Linear Attention 架构。

- **MiniMax-Text-01**: 100 万上下文，超长文本处理能力强，Linear Attention 替代 Transformer
- **MiniMax-VL-01**: 视觉-语言模型，支持图片理解 + 多轮对话
- 附 PDF 论文 + Model Card，对理解模型能力边界有帮助

**ColoBot 价值**: 🔵 研究参考。VL-01 若开放 API，可作为 Agent "视觉能力"。

---

**2. [MiniMax-M2](https://github.com/MiniMax-AI/MiniMax-M2)**
M2 模型，专为编程 + Agent 工作流打造。

**ColoBot 价值**: 🟡 潜在升级。当前用的是 M2.7，M2 可能更适合 Agent 场景。

---

**3. [MiniMax-M2.5](https://github.com/MiniMax-AI/MiniMax-M2.5)** / **[M2.7](https://github.com/MiniMax-AI/MiniMax-M2.7)**
M2.5 / M2.7 模型升级版本。

**ColoBot 价值**: 持续关注新模型发布。

---

#### 官方工具/平台类

**4. [MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP)（Python）**
官方 MCP 服务器，**核心参考**。

暴露工具（`server.py`）:
- `list_voices` — 音色列表
- `voice_clone` — 音色克隆
- `generate_video` — 视频生成
- `query_video_generation` — 查询视频任务状态
- `text_to_image` — 图片生成
- `music_generation` — 音乐生成
- `voice_design` — 音色设计

**ColoBot 价值**: 🟢 直接参考。所有工具的 API 调用方式都可以对照此实现。

---

**5. [MiniMax-MCP-JS](https://github.com/MiniMax-AI/MiniMax-MCP-JS)（TypeScript）**
同上的 TypeScript 版本，npm 包 `minimax-mcp-js`。

安装: `pnpm add minimax-mcp-js`

**ColoBot 价值**: 🟢 直接参考。比 Python 版更接近 ColoBot 技术栈。

---

**6. [cli](https://github.com/MiniMax-AI/cli)**
官方 CLI (`mmx`)，npm 包 `mmx-cli`。

```
mmx text chat --message "Hello"
mmx image generate --prompt "A cat" --n 3
mmx video generate --prompt "Ocean waves"
mmx speech synthesize --text "Hello!" --out hello.mp3
mmx music generate --prompt "Upbeat pop" --lyrics "..."
mmx search "MiniMax AI news"
mmx vision photo.jpg
```

支持全球版和中国大陆版自动切换。

**ColoBot 价值**: 🟢 直接参考。CLI 里的参数设计、API 调用模式可直接抄。

---

**7. [minimax_search](https://github.com/MiniMax-AI/minimax_search)**
MiniMax 搜索 MCP 服务器，基于 MiniMax Search API。

暴露工具:
- `search(queries: string[])` — 并行 Web 搜索
- `browse(urls: string[], query: string)` — 抓取 URL 内容后 LLM 总结

底层调用 `MiniMaxSearchBrowse` 做实际搜索/浏览。

**ColoBot 价值**: 🟢 可替代/增强现有 SearXNG 搜索。当前 ColoBot 用 SearXNG 自建，这个是 MiniMax 官方搜索能力，可对比。

---

#### Agent 架构参考类

**8. [Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent)**
MiniMax M2.5 模型的最佳实践 Agent demo，**最值得研究**。

核心特性:
- ✅ **完整 Agent 执行循环** — planning → tool calling → observation → response
- ✅ **持久化 Session Note** — 多轮对话记忆
- ✅ **自动上下文摘要** — 超过 token 上限时自动压缩历史
- ✅ **15 个 Claude Skills** — 文档/设计/测试/开发相关
- ✅ **MCP 工具支持** — 知识图谱 + 搜索
- ✅ **完整日志** — 每步请求/响应/工具执行都记录

源码结构:
```
mini_agent/
  (核心 Agent 类)
src/
skills/     ← Claude Skills 实现
test/       ← 测试
```

**ColoBot 价值**: 🟢 架构参考。ColoBot 的 runtime.ts 可以对照 Mini-Agent 的执行循环来优化。

---

**9. [MiniMax-Coding-Plan-MCP](https://github.com/MiniMax-AI/MiniMax-Coding-Plan-MCP)**
编程 Plan 用户专用的 MCP，支持 AI 搜索 + 视觉分析代码。

**ColoBot 价值**: ⚪ 非核心，针对编程 Plan 用户。

---

#### 集成类

**10. [vercel-minimax-ai-provider](https://github.com/MiniMax-AI/vercel-minimax-ai-provider)**
Vercel AI SDK 的 Provider，让 Vercel 上能跑 MiniMax 模型。

**ColoBot 价值**: ⚪ 无直接价值，除非未来部署到 Vercel。

---

**11. [OpenRoom](https://github.com/MiniMax-AI/OpenRoom)**
浏览器桌面环境，AI Agent 通过自然语言操控各种应用。

**ColoBot 价值**: 🔵 有趣的 Agent 操控 UI 研究方向，非当前优先级。

---

#### 其他

**12. [MiniMax-Hackathon](https://github.com/MiniMax-AI/MiniMax-Hackathon)**
Hackathon 资料。

**ColoBot 价值**: ⚪ 参考活动用的 demo 获取灵感。

---

**13. [MiniMax-Provider-Verifier](https://github.com/MiniMax-AI/MiniMax-Provider-Verifier)**
第三方 M2 部署验证工具。

**ColoBot 价值**: ⚪ 仅当使用第三方 MiniMax 部署时有价值。

---

### MiniMax-VL-01 视觉语言模型

[MiniMax-VL-01](https://github.com/MiniMax-AI/MiniMax-01) 是视觉-语言模型，支持图片理解 + 对话，可作为 Agent 的"眼睛"。

**关键参数**（参考 Model Card）:
- 支持单图 + 多图输入
- 图片描述、视觉问答
- 256K context window

**ColoBot 接入建议**: 等待官方开放 MiniMax-VL-01 API 或通过 MCP 接入。

**建议工具名**: `describe_image` / `vision`

```typescript
// MiniMax-VL-01 图片理解（官方 API 开放后可接）
registerTool('vision', async (args) => {
  // 传入图片 URL 或 base64，返回图片描述
});
```
