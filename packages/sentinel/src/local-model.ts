/**
 * 本地分类模型
 *
 * 使用 ONNX Runtime 加载轻量模型进行违规分类
 * 支持：仇恨/色情/暴力/越狱 等类别
 * 失败时自动降级到纯规则模式
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export type ContentCategory =
  | 'hate' // 仇恨言论
  | 'sexual' // 色情内容
  | 'violence' // 暴力内容
  | 'self_harm' // 自残
  | 'jailbreak' // 越狱尝试
  | 'safe' // 安全

export interface ClassificationResult {
  category: ContentCategory
  confidence: number
  flagged: boolean
  details?: Record<string, number>
}

export interface LocalModelConfig {
  enabled: boolean
  modelPath?: string
  threshold: number // 置信度阈值
  timeout: number // 超时时间（毫秒）
}

const DEFAULT_CONFIG: LocalModelConfig = {
  enabled: true,
  threshold: 0.7,
  timeout: 50, // 50ms 超时
}

// ═══════════════════════════════════════════════════════════════
// 模型接口
// ═══════════════════════════════════════════════════════════════

/**
 * 分类模型接口
 */
export interface IClassifier {
  classify(text: string): Promise<ClassificationResult>
  isReady(): boolean
}

// ═══════════════════════════════════════════════════════════════
// Mock 分类器（默认降级方案）
// ═══════════════════════════════════════════════════════════════

/**
 * Mock 分类器
 *
 * 当 ONNX 模型不可用时使用
 * 基于简单规则进行分类
 */
export class MockClassifier implements IClassifier {
  private ready = true

  // 关键词规则
  private rules: Array<{
    category: ContentCategory
    keywords: string[]
    patterns: RegExp[]
  }> = [
    {
      category: 'jailbreak',
      keywords: ['忽略之前的指令', 'ignore previous instructions', 'system prompt', '你现在是'],
      patterns: [/ignore\s+all\s+previous/i, /forget\s+everything/i, /you\s+are\s+now/i],
    },
    {
      category: 'hate',
      keywords: ['仇恨', '歧视', '种族'],
      patterns: [],
    },
    {
      category: 'sexual',
      keywords: ['色情', '裸体', '性'],
      patterns: [],
    },
    {
      category: 'violence',
      keywords: ['暴力', '杀', '伤害'],
      patterns: [],
    },
  ]

  async classify(text: string): Promise<ClassificationResult> {
    const lowerText = text.toLowerCase()

    for (const rule of this.rules) {
      // 检查关键词
      for (const keyword of rule.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return {
            category: rule.category,
            confidence: 0.8,
            flagged: true,
          }
        }
      }

      // 检查正则
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          return {
            category: rule.category,
            confidence: 0.85,
            flagged: true,
          }
        }
      }
    }

    return {
      category: 'safe',
      confidence: 0.9,
      flagged: false,
    }
  }

  isReady(): boolean {
    return this.ready
  }
}

// ═══════════════════════════════════════════════════════════════
// ONNX 分类器
// ═══════════════════════════════════════════════════════════════

/**
 * ONNX 分类器
 *
 * 使用 ONNX Runtime 加载模型
 * 动态导入，失败时自动降级
 */
export class ONNXClassifier implements IClassifier {
  private session: unknown | null = null
  private ready = false
  private modelPath: string
  private timeout: number

  constructor(modelPath?: string, timeout = 50) {
    this.modelPath = modelPath || ''
    this.timeout = timeout
    this.init()
  }

  private async init(): Promise<void> {
    try {
      // 动态导入 onnxruntime-node
      // 如果导入失败，保持 ready = false
      const ort = await import('onnxruntime-node').catch(() => null)

      if (ort && this.modelPath) {
        this.session = await ort.InferenceSession.create(this.modelPath)
        this.ready = true
      }
    } catch (error) {
      console.warn('[ONNXClassifier] Failed to initialize:', error)
      this.ready = false
    }
  }

  async classify(text: string): Promise<ClassificationResult> {
    if (!this.ready || !this.session) {
      throw new Error('ONNX model not ready')
    }

    // TODO: 实现实际的模型推理
    // 这里需要根据具体模型实现 tokenization 和推理
    // 目前返回安全结果
    return {
      category: 'safe',
      confidence: 0.5,
      flagged: false,
    }
  }

  isReady(): boolean {
    return this.ready
  }
}

// ═══════════════════════════════════════════════════════════════
// 分类器管理器
// ═══════════════════════════════════════════════════════════════

/**
 * 本地模型管理器
 *
 * 自动选择可用的分类器，失败时降级
 */
export class LocalModelManager {
  private config: LocalModelConfig
  private classifier: IClassifier
  private fallbackClassifier: MockClassifier

  constructor(config?: Partial<LocalModelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.fallbackClassifier = new MockClassifier()

    if (this.config.enabled && this.config.modelPath) {
      // 尝试加载 ONNX 模型
      this.classifier = new ONNXClassifier(this.config.modelPath, this.config.timeout)
    } else {
      // 使用 Mock 分类器
      this.classifier = this.fallbackClassifier
    }
  }

  /**
   * 分类文本
   */
  async classify(text: string): Promise<ClassificationResult> {
    try {
      // 尝试使用主分类器
      if (this.classifier.isReady()) {
        const result = await this.classifier.classify(text)

        // 检查置信度阈值
        if (result.confidence >= this.config.threshold) {
          return result
        }
      }
    } catch (error) {
      console.warn('[LocalModelManager] Classifier error, using fallback:', error)
    }

    // 降级到 Mock 分类器
    return this.fallbackClassifier.classify(text)
  }

  /**
   * 检查模型是否就绪
   */
  isReady(): boolean {
    return this.classifier.isReady() || this.fallbackClassifier.isReady()
  }

  /**
   * 获取当前使用的分类器类型
   */
  getClassifierType(): 'onnx' | 'mock' {
    if (this.classifier instanceof ONNXClassifier && this.classifier.isReady()) {
      return 'onnx'
    }
    return 'mock'
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultManager: LocalModelManager | null = null

export function getLocalModelManager(config?: Partial<LocalModelConfig>): LocalModelManager {
  if (!defaultManager) {
    defaultManager = new LocalModelManager(config)
  }
  return defaultManager
}

export function resetLocalModelManager(config?: Partial<LocalModelConfig>): LocalModelManager {
  defaultManager = new LocalModelManager(config)
  return defaultManager
}
