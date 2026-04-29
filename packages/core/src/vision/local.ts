/**
 * 本地视觉分析模块
 *
 * 提供 LLM 视觉能力的本地 fallback：
 * - OCR: Tesseract.js（文字识别）
 * - 图像分类: @xenova/transformers + ViT 模型
 * - 图片元数据提取
 */

import Tesseract from 'tesseract.js'
import { pipeline, env } from '@xenova/transformers'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import * as https from 'https'

// ── 配置 ──────────────────────────────────────────────

env.allowLocalModels = false
env.cacheDir =
  process.env.TRANSFORMERS_CACHE || path.join(process.env.HOME || '/tmp', '.cache', 'transformers')

export interface VisionAnalysisResult {
  text?: string // OCR 识别的文字
  labels?: string[] // 图像标签
  caption?: string // 图像描述
  confidence: number // 整体置信度
  processingTime: number // 处理时间（毫秒）
  source: 'local' | 'llm' | 'hybrid'
  error?: string
}

export interface LocalVisionConfig {
  enableOCR: boolean
  enableClassification: boolean
  ocrLanguage: string
  maxImageSize: number // 最大图片尺寸（字节）
  timeout: number // 超时时间（毫秒）
}

const DEFAULT_CONFIG: LocalVisionConfig = {
  enableOCR: true,
  enableClassification: true,
  ocrLanguage: 'chi_sim+eng', // 中文简体 + 英文
  maxImageSize: 10 * 1024 * 1024, // 10MB
  timeout: 60000,
}

let classifier: any = null
let config = DEFAULT_CONFIG

/**
 * 配置本地视觉
 */
export function configureLocalVision(options: Partial<LocalVisionConfig>): void {
  config = { ...config, ...options }
}

// ── 图片加载 ──────────────────────────────────────────────

/**
 * 加载图片数据
 */
async function loadImage(source: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(source)) {
    return source
  }

  // URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return fetchImage(source)
  }

  // 本地文件
  if (fs.existsSync(source)) {
    return fs.promises.readFile(source)
  }

  // Base64
  if (source.startsWith('data:image')) {
    const base64 = source.split(',')[1]
    return Buffer.from(base64, 'base64')
  }

  throw new Error(`Invalid image source: ${source.slice(0, 50)}...`)
}

/**
 * 从 URL 获取图片
 */
async function fetchImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const chunks: Buffer[] = []

    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

// ── OCR ──────────────────────────────────────────────

/**
 * OCR 文字识别
 */
async function performOCR(
  imageBuffer: Buffer,
  language?: string,
): Promise<{ text: string; confidence: number }> {
  const lang = language || config.ocrLanguage
  const startTime = Date.now()

  try {
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[Vision] OCR progress: ${Math.round(m.progress * 100)}%`)
        }
      },
    })

    const result = await worker.recognize(imageBuffer)
    await worker.terminate()

    const text = result.data.text.trim()
    const confidence = result.data.confidence / 100

    console.log(
      `[Vision] OCR completed in ${Date.now() - startTime}ms, confidence: ${confidence.toFixed(2)}`,
    )

    return { text, confidence }
  } catch (e) {
    console.error('[Vision] OCR failed:', (e as Error).message)
    return { text: '', confidence: 0 }
  }
}

// ── 图像分类 ──────────────────────────────────────────────

/**
 * 初始化分类器
 */
async function initClassifier(): Promise<void> {
  if (classifier) return

  console.log('[Vision] Loading image classification model...')
  const startTime = Date.now()

  classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224', {
    progress_callback: (progress: any) => {
      if (progress.status === 'downloading') {
        console.log(`[Vision] Model download: ${Math.round(progress.progress || 0)}%`)
      }
    },
  })

  console.log(`[Vision] Model loaded in ${Date.now() - startTime}ms`)
}

/**
 * 图像分类
 */
async function performClassification(
  imageBuffer: Buffer,
): Promise<{ labels: string[]; confidence: number }> {
  try {
    await initClassifier()

    if (!classifier) {
      return { labels: [], confidence: 0 }
    }

    const startTime = Date.now()

    // 将 Buffer 转换为 base64 URL
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`

    const results = await classifier(dataUrl)

    const labels = (results as Array<{ label: string; score: number }>)
      .filter((r) => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => r.label)

    const confidence = Math.max(...(results as Array<{ score: number }>).map((r) => r.score))

    console.log(`[Vision] Classification completed in ${Date.now() - startTime}ms`)

    return { labels, confidence }
  } catch (e) {
    console.error('[Vision] Classification failed:', (e as Error).message)
    return { labels: [], confidence: 0 }
  }
}

// ── 主入口 ──────────────────────────────────────────────

/**
 * 本地图片分析
 */
export async function analyzeImageLocal(
  source: string | Buffer,
  options: Partial<LocalVisionConfig> = {},
): Promise<VisionAnalysisResult> {
  const cfg = { ...config, ...options }
  const startTime = Date.now()

  try {
    const imageBuffer = await loadImage(source)

    // 检查大小
    if (imageBuffer.length > cfg.maxImageSize) {
      return {
        confidence: 0,
        processingTime: Date.now() - startTime,
        source: 'local',
        error: `Image too large: ${imageBuffer.length} > ${cfg.maxImageSize}`,
      }
    }

    const results: VisionAnalysisResult = {
      confidence: 0,
      processingTime: 0,
      source: 'local',
    }

    // 并行执行 OCR 和分类
    const tasks: Promise<void>[] = []

    if (cfg.enableOCR) {
      tasks.push(
        performOCR(imageBuffer, cfg.ocrLanguage).then(({ text, confidence }) => {
          if (text) {
            results.text = text
            results.confidence = Math.max(results.confidence, confidence * 0.6)
          }
        }),
      )
    }

    if (cfg.enableClassification) {
      tasks.push(
        performClassification(imageBuffer).then(({ labels, confidence }) => {
          if (labels.length > 0) {
            results.labels = labels
            results.confidence = Math.max(results.confidence, confidence * 0.4)
          }
        }),
      )
    }

    await Promise.all(tasks)

    // 生成简单描述
    if (results.labels?.length || results.text) {
      const parts: string[] = []
      if (results.labels?.length) {
        parts.push(`图像内容: ${results.labels.join(', ')}`)
      }
      if (results.text) {
        parts.push(
          `识别文字: ${results.text.slice(0, 200)}${results.text.length > 200 ? '...' : ''}`,
        )
      }
      results.caption = parts.join('\n')
    }

    results.processingTime = Date.now() - startTime

    return results
  } catch (e) {
    return {
      confidence: 0,
      processingTime: Date.now() - startTime,
      source: 'local',
      error: (e as Error).message,
    }
  }
}

/**
 * 图片分析（带 LLM 增强）
 */
export async function analyzeImage(
  source: string | Buffer,
  llmVision?: (imageBuffer: Buffer, context: string) => Promise<string>,
): Promise<VisionAnalysisResult> {
  const startTime = Date.now()

  // 1. 本地分析（始终执行）
  const localResult = await analyzeImageLocal(source)

  // 2. LLM 增强（可选）
  if (llmVision && localResult.confidence > 0) {
    try {
      const imageBuffer = Buffer.isBuffer(source) ? source : await loadImage(source)
      const context = localResult.caption || ''

      const enhanced = await llmVision(imageBuffer, context)

      return {
        ...localResult,
        caption: enhanced,
        confidence: Math.min(localResult.confidence + 0.3, 1),
        source: 'hybrid',
        processingTime: Date.now() - startTime,
      }
    } catch (e) {
      console.warn('[Vision] LLM enhancement failed:', (e as Error).message)
    }
  }

  return localResult
}

// ── 缓存 ──────────────────────────────────────────────

const analysisCache = new Map<string, { result: VisionAnalysisResult; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 小时

function getCacheKey(source: string | Buffer): string {
  if (Buffer.isBuffer(source)) {
    // 简单 hash
    const hash = source.slice(0, 1024).reduce((acc, byte) => ((acc << 5) - acc + byte) | 0, 0)
    return `buffer-${hash}-${source.length}`
  }
  return source
}

/**
 * 带缓存的图片分析
 */
export async function analyzeImageCached(
  source: string | Buffer,
  llmVision?: (imageBuffer: Buffer, context: string) => Promise<string>,
): Promise<VisionAnalysisResult> {
  const key = getCacheKey(source)
  const cached = analysisCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Vision] Using cached result')
    return cached.result
  }

  const result = await analyzeImage(source, llmVision)
  analysisCache.set(key, { result, timestamp: Date.now() })

  // 清理过期缓存
  if (analysisCache.size > 100) {
    const now = Date.now()
    for (const [k, v] of analysisCache) {
      if (now - v.timestamp > CACHE_TTL) {
        analysisCache.delete(k)
      }
    }
  }

  return result
}

/**
 * 清除缓存
 */
export function clearVisionCache(): void {
  analysisCache.clear()
}
