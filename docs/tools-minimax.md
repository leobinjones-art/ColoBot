# @colobot/tools-minimax - MiniMax 工具兼容

## 概述

`@colobot/tools-minimax` 提供 MiniMax 特有工具的兼容适配器，包括语音合成、语音识别、文生图等 MiniMax 独有的 AI 能力。

> **注意**：MiniMax LLM 模型调用已内置在 `@colobot/core` 中，本包仅提供 MiniMax 特有的工具能力。

## MiniMax 特有工具

| 工具 | 说明 | API |
|------|------|-----|
| 🎙️ 语音合成 (TTS) | 文本转语音，支持多种音色 | `minimax_tts` |
| 🎧 语音识别 (ASR) | 语音转文本，支持多语言 | `minimax_asr` |
| 🖼️ 文生图 | 文本生成图片 | `minimax_image_gen` |
| 🎵 音乐生成 | 文本生成音乐 | `minimax_music_gen` |
| 🎬 视频生成 | 文本/图片生成视频 | `minimax_video_gen` |

## 安装

```bash
npm install @colobot/tools-minimax
```

## 使用

### 注册工具

```typescript
import { ToolRegistry } from '@colobot/core'
import { registerMiniMaxTools } from '@colobot/tools-minimax'

// 注册所有 MiniMax 工具
registerMiniMaxTools({
  apiKey: process.env.MINIMAX_API_KEY,
  groupId: process.env.MINIMAX_GROUP_ID
})
```

### 语音合成 (TTS)

```typescript
// 在对话中使用
const response = await agent.processMessage({
  text: '用 MiniMax 语音朗读这段话：你好世界',
  tools: ['minimax_tts']
})

// 直接调用
import { textToSpeech } from '@colobot/tools-minimax'

const audioBuffer = await textToSpeech({
  text: '你好，欢迎使用 ColoBot',
  voiceId: 'female-tianmei',  // 音色
  model: 'speech-01'          // 模型
})

// 保存音频文件
fs.writeFileSync('output.mp3', audioBuffer)
```

### 语音识别 (ASR)

```typescript
import { speechToText } from '@colobot/tools-minimax'

// 从音频文件识别
const text = await speechToText({
  audioPath: './recording.mp3',
  language: 'zh'
})

console.log('识别结果:', text)
```

### 文生图

```typescript
import { generateImage } from '@colobot/tools-minimax'

const images = await generateImage({
  prompt: '一只可爱的猫咪在阳光下打盹',
  model: 'image-01',
  size: '1024x1024',
  n: 1
})

// images[0].url 或 images[0].base64
```

### 音乐生成

```typescript
import { generateMusic } from '@colobot/tools-minimax'

const music = await generateMusic({
  prompt: '轻快的电子音乐，适合运动',
  duration: 30,  // 秒
  style: 'electronic'
})

fs.writeFileSync('music.mp3', music.buffer)
```

### 视频生成

```typescript
import { generateVideo } from '@colobot/tools-minimax'

const video = await generateVideo({
  prompt: '海边日落，海浪轻轻拍打沙滩',
  model: 'video-01',
  duration: 5,  // 秒
  aspectRatio: '16:9'
})
```

## 工具定义

### minimax_tts

```typescript
{
  name: 'minimax_tts',
  description: '使用 MiniMax 语音合成将文本转为语音',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: '要转换的文本'
      },
      voice_id: {
        type: 'string',
        enum: ['female-tianmei', 'male-qn-qingse', 'female-shaonv', 'presenter_male'],
        description: '音色ID'
      },
      speed: {
        type: 'number',
        description: '语速 (0.5-2.0)'
      },
      output_format: {
        type: 'string',
        enum: ['mp3', 'wav', 'pcm'],
        description: '输出格式'
      }
    },
    required: ['text']
  }
}
```

### minimax_asr

```typescript
{
  name: 'minimax_asr',
  description: '使用 MiniMax 语音识别将音频转为文本',
  parameters: {
    type: 'object',
    properties: {
      audio_url: {
        type: 'string',
        description: '音频文件URL'
      },
      language: {
        type: 'string',
        enum: ['zh', 'en', 'ja', 'ko'],
        description: '音频语言'
      }
    },
    required: ['audio_url']
  }
}
```

### minimax_image_gen

```typescript
{
  name: 'minimax_image_gen',
  description: '使用 MiniMax 文生图生成图片',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '图片描述'
      },
      size: {
        type: 'string',
        enum: ['512x512', '1024x1024', '1024x1792', '1792x1024'],
        description: '图片尺寸'
      },
      n: {
        type: 'number',
        description: '生成数量 (1-4)'
      }
    },
    required: ['prompt']
  }
}
```

### minimax_music_gen

```typescript
{
  name: 'minimax_music_gen',
  description: '使用 MiniMax 生成音乐',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '音乐描述'
      },
      duration: {
        type: 'number',
        description: '时长（秒）'
      },
      style: {
        type: 'string',
        description: '音乐风格'
      }
    },
    required: ['prompt']
  }
}
```

### minimax_video_gen

```typescript
{
  name: 'minimax_video_gen',
  description: '使用 MiniMax 生成视频',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '视频描述'
      },
      image_url: {
        type: 'string',
        description: '参考图片URL（可选）'
      },
      duration: {
        type: 'number',
        description: '时长（秒）'
      }
    },
    required: ['prompt']
  }
}
```

## 支持的音色

| 音色 ID | 名称 | 风格 |
|---------|------|------|
| `female-tianmei` | 甜美女声 | 温柔、甜美 |
| `male-qn-qingse` | 青涩男声 | 年轻、清澈 |
| `female-shaonv` | 少女音 | 活泼、可爱 |
| `presenter_male` | 男主持 | 专业、稳重 |
| `presenter_female` | 女主持 | 专业、大方 |
| `audiobook_male_1` | 有声书男声 | 沉稳、讲故事 |
| `audiobook_female_1` | 有声书女声 | 温柔、讲故事 |

## API

### registerMiniMaxTools

```typescript
function registerMiniMaxTools(config: MiniMaxConfig): void

interface MiniMaxConfig {
  apiKey: string
  groupId: string
  apiEndpoint?: string
  defaultVoiceId?: string
  defaultModel?: {
    tts?: string
    asr?: string
    image?: string
    music?: string
    video?: string
  }
}
```

### textToSpeech

```typescript
function textToSpeech(options: TTSOptions): Promise<Buffer>

interface TTSOptions {
  text: string
  voiceId?: string
  model?: string
  speed?: number
  outputFormat?: 'mp3' | 'wav' | 'pcm'
}
```

### speechToText

```typescript
function speechToText(options: ASROptions): Promise<string>

interface ASROptions {
  audioPath?: string
  audioUrl?: string
  audioBuffer?: Buffer
  language?: string
}
```

### generateImage

```typescript
function generateImage(options: ImageOptions): Promise<ImageResult[]>

interface ImageOptions {
  prompt: string
  model?: string
  size?: string
  n?: number
  responseFormat?: 'url' | 'b64_json'
}
```

### generateMusic

```typescript
function generateMusic(options: MusicOptions): Promise<MusicResult>

interface MusicOptions {
  prompt: string
  duration?: number
  style?: string
  model?: string
}
```

### generateVideo

```typescript
function generateVideo(options: VideoOptions): Promise<VideoResult>

interface VideoOptions {
  prompt: string
  imageUrl?: string
  duration?: number
  aspectRatio?: string
  model?: string
}
```

## 目录结构

```
packages/tools-minimax/
├── src/
│   ├── index.ts            # 导出入口
│   ├── register.ts         # 工具注册
│   ├── tts.ts              # 语音合成
│   ├── asr.ts              # 语音识别
│   ├── image.ts            # 文生图
│   ├── music.ts            # 音乐生成
│   ├── video.ts            # 视频生成
│   ├── client.ts           # API 客户端
│   └── types/
│       ├── tts.ts
│       ├── asr.ts
│       └── media.ts
├── tests/
│   ├── tts.test.ts
│   ├── asr.test.ts
│   └── image.test.ts
├── package.json
└── README.md
```

## 依赖

```json
{
  "dependencies": {
    "@colobot/core": "^0.1.0",
    "form-data": "^4.0.0"     // 文件上传
  }
}
```

## Dashboard 集成

在工具管理页面显示 MiniMax 工具状态：

```
┌─────────────────────────────────────────────────────────────┐
│ Tools Management                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ MiniMax Tools                                    [已启用 ✓] │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 🎙️ minimax_tts     文本转语音          ✅ 可用       │    │
│ │ 🎧 minimax_asr     语音转文本          ✅ 可用       │    │
│ │ 🖼️ minimax_image   文生图              ✅ 可用       │    │
│ │ 🎵 minimax_music   音乐生成            ✅ 可用       │    │
│ │ 🎬 minimax_video   视频生成            ✅ 可用       │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ 配置:                                                       │
│   API Key: [••••••••••••••••••]                             │
│   Group ID: [your-group-id    ]                             │
│                                                             │
│ [测试连接]  [保存配置]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 与其他工具对比

| 功能 | OpenAI | MiniMax | 说明 |
|------|--------|---------|------|
| TTS | ✅ | ✅ | MiniMax 音色更丰富 |
| ASR | ✅ | ✅ | MiniMax 中文识别更准 |
| 文生图 | ✅ (DALL-E) | ✅ | 风格不同 |
| 音乐生成 | ❌ | ✅ | MiniMax 独有 |
| 视频生成 | ❌ | ✅ | MiniMax 独有 |

## 开发计划

| 阶段 | 功能 | 时间 |
|------|------|------|
| Phase 1 | TTS + ASR | 1 天 |
| Phase 2 | 文生图 | 1 天 |
| Phase 3 | 音乐 + 视频生成 | 1 天 |
| Phase 4 | 工具注册 + Dashboard 集成 | 1 天 |
| **总计** | | **4 天** |

## 与其他包的关系

```
@colobot/tools-minimax
    └── @colobot/core (必需)
```

## 使用场景

1. **语音助手**：TTS + ASR 实现语音交互
2. **内容创作**：文生图、音乐、视频生成
3. **有声读物**：批量文本转语音
4. **会议记录**：语音转文本记录
