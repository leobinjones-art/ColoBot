/**
 * 法律条文学习器
 *
 * 上传文档 → LLM 提纯关键词 → 存入规则库
 */

import type { LLMProvider } from '@colomind/core'
import { createLogger } from './logger.js'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const logger = createLogger('LegalLearner')

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface LegalDocument {
  id: string
  law: string
  article: string
  content: string
  keywords: string[]
  tags: string[]
  summary: string
  createdAt: string
}

export interface LearningResult {
  success: boolean
  document?: LegalDocument
  error?: string
}

export interface LegalLearnerConfig {
  llmProvider?: LLMProvider
  model?: string
  storagePath?: string
}

// ═══════════════════════════════════════════════════════════════
// 学习提示词
// ═══════════════════════════════════════════════════════════════

const EXTRACTION_PROMPT = `分析以下法律条文，提取关键信息：

法律名称：{law}
条文号：{article}
内容：{content}

请以 JSON 格式输出：
{
  "keywords": ["关键词1", "关键词2", ...],  // 5-10个核心关键词，用于检索匹配
  "tags": ["标签1", "标签2", ...],          // 2-5个场景标签，如"动物尸体"、"网络安全"
  "summary": "一句话概括条文要点"            // 简明扼要的说明
}

注意：
1. keywords 应包含条文中的专业术语和关键概念
2. tags 应反映条文适用的场景类型
3. summary 应简洁明了，便于快速理解`

// ═══════════════════════════════════════════════════════════════
// 法律条文学习器
// ═══════════════════════════════════════════════════════════════

export class LegalLearner {
  private llmProvider?: LLMProvider
  private model: string
  private storagePath: string
  private documents: Map<string, LegalDocument> = new Map()

  constructor(config: LegalLearnerConfig = {}) {
    this.llmProvider = config.llmProvider
    this.model = config.model || 'gpt-4o-mini'
    this.storagePath = config.storagePath || './legal-docs/learned'
  }

  /**
   * 学习法律条文
   */
  async learn(law: string, article: string, content: string): Promise<LearningResult> {
    const id = this.generateId(law, article)

    // 检查是否已学习
    if (this.documents.has(id)) {
      return { success: true, document: this.documents.get(id) }
    }

    // 使用 LLM 提纯关键词
    let keywords: string[] = []
    let tags: string[] = []
    let summary = ''

    if (this.llmProvider) {
      try {
        const extracted = await this.extractWithLLM(law, article, content)
        keywords = extracted.keywords
        tags = extracted.tags
        summary = extracted.summary
      } catch (error) {
        logger.warn('LLM extraction failed, using fallback', { error })
        keywords = this.fallbackKeywords(content)
        tags = this.fallbackTags(law)
        summary = content.slice(0, 100)
      }
    } else {
      keywords = this.fallbackKeywords(content)
      tags = this.fallbackTags(law)
      summary = content.slice(0, 100)
    }

    const doc: LegalDocument = {
      id,
      law,
      article,
      content,
      keywords,
      tags,
      summary,
      createdAt: new Date().toISOString(),
    }

    this.documents.set(id, doc)
    await this.saveDocument(doc)

    logger.info('Legal document learned', { id, law, article, keywords })

    return { success: true, document: doc }
  }

  /**
   * 批量学习
   */
  async learnBatch(items: Array<{ law: string; article: string; content: string }>): Promise<number> {
    let count = 0
    for (const item of items) {
      const result = await this.learn(item.law, item.article, item.content)
      if (result.success) count++
    }
    return count
  }

  /**
   * 从文件学习
   */
  async learnFromFile(filePath: string): Promise<number> {
    const content = await readFile(filePath, 'utf-8')
    const items = JSON.parse(content)

    if (Array.isArray(items)) {
      return this.learnBatch(items)
    }

    // 单条文档
    if (items.law && items.article && items.content) {
      const result = await this.learn(items.law, items.article, items.content)
      return result.success ? 1 : 0
    }

    return 0
  }

  /**
   * 搜索相关条文
   */
  search(query: string): LegalDocument[] {
    const results: Array<{ doc: LegalDocument; score: number }> = []

    for (const doc of this.documents.values()) {
      let score = 0

      // 关键词匹配
      for (const kw of doc.keywords) {
        if (query.includes(kw)) score += 2
      }

      // 标签匹配
      for (const tag of doc.tags) {
        if (query.includes(tag)) score += 3
      }

      // 内容匹配
      if (doc.content.includes(query)) score += 1

      if (score > 0) {
        results.push({ doc, score })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.doc)
  }

  /**
   * 根据标签获取条文
   */
  getByTags(tags: string[]): LegalDocument[] {
    return Array.from(this.documents.values()).filter(doc =>
      tags.some(tag => doc.tags.includes(tag))
    )
  }

  /**
   * 获取所有已学习的条文
   */
  getAll(): LegalDocument[] {
    return Array.from(this.documents.values())
  }

  /**
   * 加载已学习的条文
   */
  async load(): Promise<number> {
    try {
      if (!existsSync(this.storagePath)) {
        await mkdir(this.storagePath, { recursive: true })
        return 0
      }

      const { readdir } = await import('fs/promises')
      const files = await readdir(this.storagePath)
      let count = 0

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(this.storagePath, file), 'utf-8')
          const doc = JSON.parse(content) as LegalDocument
          this.documents.set(doc.id, doc)
          count++
        }
      }

      logger.info(`Loaded ${count} legal documents`)
      return count
    } catch (error) {
      logger.warn('Failed to load legal documents', { error })
      return 0
    }
  }

  /**
   * 删除条文
   */
  async delete(id: string): Promise<boolean> {
    const doc = this.documents.get(id)
    if (!doc) return false

    this.documents.delete(id)

    try {
      const { unlink } = await import('fs/promises')
      await unlink(join(this.storagePath, `${id}.json`))
      return true
    } catch {
      return false
    }
  }

  // ─── 私有方法 ───────────────────────────────────────────────

  private async extractWithLLM(
    law: string,
    article: string,
    content: string
  ): Promise<{ keywords: string[]; tags: string[]; summary: string }> {
    if (!this.llmProvider) {
      throw new Error('No LLM provider')
    }

    const prompt = EXTRACTION_PROMPT
      .replace('{law}', law)
      .replace('{article}', article)
      .replace('{content}', content)

    const response = await this.llmProvider.chat([
      { role: 'user', content: prompt },
    ], { model: this.model })

    const text = typeof response.content === 'string'
      ? response.content
      : response.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('')

    // 解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('Failed to parse LLM response')
  }

  private fallbackKeywords(content: string): string[] {
    // 简单提取：取长度大于2的词
    const words = content.match(/[\u4e00-\u9fa5]{2,}/g) || []
    return [...new Set(words)].slice(0, 10)
  }

  private fallbackTags(law: string): string[] {
    // 根据法律名称推断标签
    const tagMap: Record<string, string[]> = {
      '动物防疫法': ['动物', '防疫'],
      '网络安全法': ['网络安全', '计算机'],
      '刑法': ['刑事', '犯罪'],
      '野生动物保护法': ['野生动物', '保护'],
      '个人信息保护法': ['个人信息', '隐私'],
    }

    for (const [key, tags] of Object.entries(tagMap)) {
      if (law.includes(key)) return tags
    }

    return ['法律']
  }

  private generateId(law: string, article: string): string {
    return `${law}-${article}`.replace(/\s+/g, '_')
  }

  private async saveDocument(doc: LegalDocument): Promise<void> {
    try {
      if (!existsSync(this.storagePath)) {
        await mkdir(this.storagePath, { recursive: true })
      }

      const filePath = join(this.storagePath, `${doc.id}.json`)
      await writeFile(filePath, JSON.stringify(doc, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save document', { error })
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultLearner: LegalLearner | null = null

export function getLegalLearner(config?: LegalLearnerConfig): LegalLearner {
  if (!defaultLearner) {
    defaultLearner = new LegalLearner(config)
  }
  return defaultLearner
}

export function resetLegalLearner(config?: LegalLearnerConfig): LegalLearner {
  defaultLearner = new LegalLearner(config)
  return defaultLearner
}
