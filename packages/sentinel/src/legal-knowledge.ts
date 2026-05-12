/**
 * 法律知识库 - 全球法律学习架构
 *
 * 三层架构：
 * 1. 全球法律文本解析 - 提取结构化信息
 * 2. 法域特征提炼 - 同一行为在不同法域的定性
 * 3. 动态任务绑定 - 根据 Charter/法域自动加载
 */

import { createLogger } from './logger.js'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

const logger = createLogger('LegalKnowledge')

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 法域/司法管辖区 */
export type Jurisdiction =
  | 'CN' // 中国
  | 'US' // 美国
  | 'EU' // 欧盟
  | 'JP' // 日本
  | 'UK' // 英国
  | 'KR' // 韩国
  | 'AU' // 澳大利亚
  | 'CA' // 加拿大
  | 'SG' // 新加坡
  | 'OTHER'

/** 法律后果类型 */
export interface LegalConsequence {
  /** 后果类型 */
  type: 'fine' | 'imprisonment' | 'license_revocation' | 'administrative' | 'civil' | 'criminal'
  /** 描述 */
  description: string
  /** 严重程度 */
  severity: 'minor' | 'moderate' | 'serious' | 'severe'
  /** 具体数值（如罚款金额、监禁年限） */
  value?: string
}

/** 违规要件 */
export interface ViolationElements {
  /** 主观目的 */
  purpose?: string[]
  /** 实施手段 */
  means?: string[]
  /** 行为后果 */
  consequence?: string[]
  /** 行为对象 */
  target?: string[]
}

/** 法律条文 */
export interface LegalProvision {
  /** 条文ID */
  id: string
  /** 法律名称 */
  law: string
  /** 条文号 */
  article: string
  /** 条文内容 */
  content: string
  /** 适用法域 */
  jurisdiction: Jurisdiction
  /** 违规行为描述 */
  violationDescription?: string
  /** 违规要件 */
  violationElements?: ViolationElements
  /** 法律后果 */
  consequences?: LegalConsequence[]
  /** 适用场景标签 */
  tags: string[]
  /** 简要说明 */
  summary?: string
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  /** 生效日期 */
  effectiveDate?: string
  /** 是否现行有效 */
  isActive?: boolean
}

/** 法域知识库模块 */
export interface JurisdictionModule {
  /** 法域代码 */
  jurisdiction: Jurisdiction
  /** 法域名称 */
  name: string
  /** 法律条文 */
  provisions: LegalProvision[]
  /** 特殊规则 */
  specialRules?: string[]
  /** 合规渠道 */
  complianceChannels?: ComplianceChannel[]
}

/** 合规渠道 */
export interface ComplianceChannel {
  /** 渠道名称 */
  name: string
  /** 描述 */
  description: string
  /** 联系方式 */
  contact?: string
  /** 适用场景 */
  applicableScenarios: string[]
}

/** 推理上下文 */
export interface ReasoningContext {
  /** 用户消息 */
  userMessage: string
  /** 用户所在法域 */
  userJurisdiction: Jurisdiction
  /** Charter 类型 */
  charterType?: string
  /** 涉及的行为 */
  action?: string
  /** 涉及的对象 */
  target?: string
}

/** 推理结果 */
export interface LegalReasoningResult {
  /** 是否合法 */
  isLegal: boolean
  /** 置信度 */
  confidence: number
  /** 相关法律条文 */
  relevantProvisions: LegalProvision[]
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  /** 推理依据 */
  reasoning: string
  /** 建议的合规渠道 */
  recommendedChannels: ComplianceChannel[]
  /** 跨法域提示 */
  crossJurisdictionNotes?: string[]
}

// ═══════════════════════════════════════════════════════════════
// 法律知识库
// ═══════════════════════════════════════════════════════════════

export class LegalKnowledgeBase {
  private provisions: Map<Jurisdiction, LegalProvision[]> = new Map()
  private complianceChannels: Map<Jurisdiction, ComplianceChannel[]> = new Map()
  private loaded = false
  private dataPath?: string

  constructor(dataPath?: string) {
    this.dataPath = dataPath
  }

  /**
   * 从目录加载法律条文
   * 目录结构：
   *   legal-docs/
   *     CN/  # 中国法律
   *       criminal-law.txt
   *       administrative-law.txt
   *     US/  # 美国法律
   *       ...
   *
   * txt 文件格式：
   *   【法律名称】中华人民共和国刑法
   *   【条文号】第一百一十四条
   *   【内容】放火、决水、爆炸...
   *   【标签】公共安全,危险方法,爆炸
   *   【风险等级】critical
   *   ---
   *   【法律名称】...
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    try {
      const jurisdictions = await readdir(dirPath)
      let totalLoaded = 0

      for (const jurDir of jurisdictions) {
        const jurPath = join(dirPath, jurDir)
        const jurStat = await stat(jurPath)

        if (!jurStat.isDirectory()) continue

        const jurisdiction = jurDir.toUpperCase() as Jurisdiction
        const provisions: LegalProvision[] = []

        const files = await readdir(jurPath)
        for (const file of files) {
          const filePath = join(jurPath, file)
          const content = await readFile(filePath, 'utf-8')

          try {
            if (file.endsWith('.json')) {
              const parsed = JSON.parse(content)
              const items = Array.isArray(parsed) ? parsed : [parsed]
              for (const item of items) {
                provisions.push({
                  ...item,
                  jurisdiction,
                  id: item.id || `${jurisdiction}-${item.law}-${item.article}`,
                })
              }
            } else if (file.endsWith('.txt')) {
              const parsed = this.parseTxtContent(content, jurisdiction)
              provisions.push(...parsed)
            }
          } catch (parseError) {
            logger.warn(`Failed to parse ${filePath}`, { parseError })
          }
        }

        this.provisions.set(jurisdiction, provisions)
        totalLoaded += provisions.length
        logger.info(`Loaded ${provisions.length} provisions for ${jurisdiction}`)
      }

      this.loaded = true
      return totalLoaded
    } catch (error) {
      logger.warn('Failed to load legal documents, using defaults', { error })
      this.initializeDefaults()
      return this.getTotalCount()
    }
  }

  /**
   * 解析 txt 格式的法律条文
   *
   * 格式示例：
   * 【法律名称】中华人民共和国刑法
   * 【条文号】第一百一十四条
   * 【内容】放火、决水、爆炸、投放危险物质或者以其他危险方法危害公共安全...
   * 【标签】公共安全,危险方法,爆炸,炸弹
   * 【风险等级】critical
   * 【违规描述】以危险方法危害公共安全
   * 【简要说明】以危险方法危害公共安全属刑事犯罪
   * ---
   */
  private parseTxtContent(content: string, jurisdiction: Jurisdiction): LegalProvision[] {
    const provisions: LegalProvision[] = []
    const blocks = content.split(/\n---+\n/)

    for (const block of blocks) {
      if (!block.trim()) continue

      const provision = this.parseTxtBlock(block, jurisdiction)
      if (provision) {
        provisions.push(provision)
      }
    }

    return provisions
  }

  /**
   * 解析单个 txt 块
   */
  private parseTxtBlock(block: string, jurisdiction: Jurisdiction): LegalProvision | null {
    const fields: Record<string, string> = {}

    // 解析字段
    const lines = block.split('\n')
    for (const line of lines) {
      const match = line.match(/【(.+?)】(.*)/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        fields[key] = value
      }
    }

    // 必须有法律名称和条文号
    if (!fields['法律名称'] && !fields['law']) return null
    if (!fields['条文号'] && !fields['article']) return null

    const law = fields['法律名称'] || fields['law'] || ''
    const article = fields['条文号'] || fields['article'] || ''

    return {
      id: `${jurisdiction}-${law}-${article}`,
      law,
      article,
      content: fields['内容'] || fields['content'] || '',
      jurisdiction,
      violationDescription: fields['违规描述'] || fields['violationDescription'],
      violationElements: this.parseViolationElements(fields['违规要件'] || fields['violationElements']),
      consequences: this.parseConsequences(fields['法律后果'] || fields['consequences']),
      tags: this.parseTags(fields['标签'] || fields['tags'] || ''),
      summary: fields['简要说明'] || fields['summary'],
      riskLevel: this.parseRiskLevel(fields['风险等级'] || fields['riskLevel']),
      isActive: true,
    }
  }

  /**
   * 解析标签
   */
  private parseTags(tagsStr: string): string[] {
    if (!tagsStr) return []
    return tagsStr.split(/[,，、;；\s]+/).filter(t => t.trim())
  }

  /**
   * 解析风险等级
   */
  private parseRiskLevel(level: string): 'low' | 'medium' | 'high' | 'critical' {
    const levelMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      '低': 'low',
      '中': 'medium',
      '高': 'high',
      '严重': 'critical',
      '极严重': 'critical',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical',
    }
    return levelMap[level.toLowerCase()] || 'medium'
  }

  /**
   * 解析违规要件
   * 格式：目的:xxx; 手段:xxx; 后果:xxx; 对象:xxx
   */
  private parseViolationElements(str?: string): ViolationElements | undefined {
    if (!str) return undefined

    const elements: ViolationElements = {}
    const parts = str.split(/[;；]/)

    for (const part of parts) {
      const [key, value] = part.split(/[:：]/)
      if (!key || !value) continue

      const k = key.trim()
      const v = value.split(/[,，、]/).map(s => s.trim()).filter(s => s)

      if (k.includes('目的') || k.toLowerCase().includes('purpose')) {
        elements.purpose = v
      } else if (k.includes('手段') || k.toLowerCase().includes('means')) {
        elements.means = v
      } else if (k.includes('后果') || k.toLowerCase().includes('consequence')) {
        elements.consequence = v
      } else if (k.includes('对象') || k.toLowerCase().includes('target')) {
        elements.target = v
      }
    }

    return Object.keys(elements).length > 0 ? elements : undefined
  }

  /**
   * 解析法律后果
   * 格式：有期徒刑:三年以上十年以下; 罚款:五万元以上
   */
  private parseConsequences(str?: string): LegalConsequence[] | undefined {
    if (!str) return undefined

    const consequences: LegalConsequence[] = []
    const parts = str.split(/[;；]/)

    for (const part of parts) {
      const [typeStr, value] = part.split(/[:：]/)
      if (!typeStr) continue

      const t = typeStr.trim()
      const type = this.mapConsequenceType(t)

      consequences.push({
        type,
        description: t,
        severity: this.mapSeverity(type),
        value: value?.trim(),
      })
    }

    return consequences.length > 0 ? consequences : undefined
  }

  /**
   * 映射后果类型
   */
  private mapConsequenceType(type: string): LegalConsequence['type'] {
    const typeMap: Record<string, LegalConsequence['type']> = {
      '有期徒刑': 'imprisonment',
      '无期徒刑': 'imprisonment',
      '死刑': 'imprisonment',
      '拘役': 'administrative',
      '管制': 'administrative',
      '罚款': 'fine',
      '罚金': 'fine',
      '没收财产': 'fine',
      '吊销许可证': 'license_revocation',
      '吊销执照': 'license_revocation',
      '刑事': 'criminal',
      '民事': 'civil',
    }
    return typeMap[type] || 'administrative'
  }

  /**
   * 映射严重程度
   */
  private mapSeverity(type: LegalConsequence['type']): LegalConsequence['severity'] {
    const severityMap: Record<LegalConsequence['type'], LegalConsequence['severity']> = {
      'imprisonment': 'severe',
      'criminal': 'severe',
      'fine': 'serious',
      'license_revocation': 'serious',
      'administrative': 'moderate',
      'civil': 'moderate',
    }
    return severityMap[type] || 'moderate'
  }

  /**
   * 初始化默认法律条文（中国法域试点）
   */
  initializeDefaults(): void {
    const cnProvisions: LegalProvision[] = [
      {
        id: 'CN-animal-epidemic-21',
        law: '中华人民共和国动物防疫法',
        article: '第二十一条',
        content: '动物尸体应当按照国家规定进行无害化处理，不得随意丢弃。',
        jurisdiction: 'CN',
        violationDescription: '随意丢弃动物尸体',
        violationElements: {
          target: ['动物尸体'],
          consequence: ['未进行无害化处理', '随意丢弃'],
        },
        consequences: [
          { type: 'administrative', description: '责令改正', severity: 'minor' },
          { type: 'fine', description: '罚款', severity: 'moderate', value: '一千元以上一万元以下' },
        ],
        tags: ['动物尸体', '无害化处理', '宠物', '动物防疫'],
        summary: '动物尸体必须无害化处理，禁止随意丢弃',
        riskLevel: 'medium',
        isActive: true,
      },
      {
        id: 'CN-cybersecurity-27',
        law: '中华人民共和国网络安全法',
        article: '第二十七条',
        content: '任何个人和组织不得从事非法侵入他人网络、干扰他人网络正常功能、窃取网络数据等危害网络安全的活动。',
        jurisdiction: 'CN',
        violationDescription: '非法侵入网络、窃取数据',
        violationElements: {
          purpose: ['非法获取数据', '破坏系统'],
          means: ['侵入网络', '干扰功能', '窃取数据'],
          target: ['他人网络', '网络数据'],
        },
        consequences: [
          { type: 'administrative', description: '责令改正', severity: 'minor' },
          { type: 'fine', description: '罚款', severity: 'moderate', value: '五万元以上五十万元以下' },
          { type: 'criminal', description: '刑事责任', severity: 'severe' },
        ],
        tags: ['网络安全', '黑客', '入侵', '数据窃取', '禁止'],
        summary: '禁止非法侵入网络、窃取数据',
        riskLevel: 'critical',
        isActive: true,
      },
      {
        id: 'CN-criminal-114',
        law: '中华人民共和国刑法',
        article: '第一百一十四条',
        content: '放火、决水、爆炸、投放危险物质或者以其他危险方法危害公共安全，尚未造成严重后果的，处三年以上十年以下有期徒刑。',
        jurisdiction: 'CN',
        violationDescription: '以危险方法危害公共安全',
        violationElements: {
          purpose: ['危害公共安全'],
          means: ['放火', '决水', '爆炸', '投放危险物质', '其他危险方法'],
          consequence: ['危害公共安全'],
        },
        consequences: [
          { type: 'imprisonment', description: '有期徒刑', severity: 'severe', value: '三年以上十年以下' },
        ],
        tags: ['公共安全', '危险方法', '放火', '爆炸', '刑事犯罪'],
        summary: '以危险方法危害公共安全属刑事犯罪',
        riskLevel: 'critical',
        isActive: true,
      },
      {
        id: 'CN-criminal-347',
        law: '中华人民共和国刑法',
        article: '第三百四十七条',
        content: '走私、贩卖、运输、制造毒品，无论数量多少，都应当追究刑事责任，予以刑事处罚。',
        jurisdiction: 'CN',
        violationDescription: '毒品犯罪',
        violationElements: {
          purpose: ['非法获利', '传播毒品'],
          means: ['走私', '贩卖', '运输', '制造'],
          target: ['毒品'],
        },
        consequences: [
          { type: 'imprisonment', description: '有期徒刑', severity: 'severe', value: '十五年有期徒刑、无期徒刑或死刑' },
          { type: 'fine', description: '没收财产', severity: 'severe' },
        ],
        tags: ['毒品', '刑事犯罪', '走私', '贩卖'],
        summary: '毒品犯罪无论数量均追究刑事责任',
        riskLevel: 'critical',
        isActive: true,
      },
      {
        id: 'CN-hazardous-chemicals',
        law: '危险化学品安全管理条例',
        article: '第七十七条',
        content: '未经许可，任何单位和个人不得经营危险化学品。',
        jurisdiction: 'CN',
        violationDescription: '无证经营危险化学品',
        violationElements: {
          purpose: ['经营获利'],
          means: ['未经许可', '无证经营'],
          target: ['危险化学品'],
        },
        consequences: [
          { type: 'administrative', description: '责令停止经营活动', severity: 'moderate' },
          { type: 'fine', description: '罚款', severity: 'serious', value: '十万元以上二十万元以下' },
          { type: 'criminal', description: '构成犯罪的追究刑事责任', severity: 'severe' },
        ],
        tags: ['危险化学品', '许可证', '经营', '安全'],
        summary: '经营危险化学品需取得许可',
        riskLevel: 'high',
        isActive: true,
      },
    ]

    this.provisions.set('CN', cnProvisions)

    // 中国法域的合规渠道
    const cnChannels: ComplianceChannel[] = [
      {
        name: '12348法律援助热线',
        description: '免费法律咨询服务',
        contact: '拨打12348',
        applicableScenarios: ['法律咨询', '法律援助'],
      },
      {
        name: '当地律师事务所',
        description: '专业法律咨询服务',
        contact: '搜索"律师事务所 + 城市名"',
        applicableScenarios: ['法律咨询', '诉讼代理'],
      },
      {
        name: '宠物殡葬服务',
        description: '提供宠物火化、安葬等专业服务',
        contact: '搜索"宠物殡葬 + 城市名"',
        applicableScenarios: ['宠物尸体处理', '动物无害化处理'],
      },
      {
        name: '动物无害化处理中心',
        description: '政府指定的动物尸体处理机构',
        contact: '联系当地农业农村部门',
        applicableScenarios: ['动物尸体处理', '大型动物处理'],
      },
      {
        name: '国家互联网应急中心',
        description: '网络安全事件报告',
        contact: 'www.cert.org.cn',
        applicableScenarios: ['网络安全', '漏洞报告'],
      },
      {
        name: '公安机关网安部门',
        description: '网络犯罪举报',
        contact: '拨打110或网络举报平台',
        applicableScenarios: ['网络犯罪', '网络诈骗'],
      },
    ]

    this.complianceChannels.set('CN', cnChannels)
    this.loaded = true
  }

  /**
   * 根据法域获取法律条文
   */
  getProvisionsByJurisdiction(jurisdiction: Jurisdiction): LegalProvision[] {
    this.ensureLoaded()
    return this.provisions.get(jurisdiction) || []
  }

  /**
   * 根据标签查询（支持多法域）
   */
  findByTags(tags: string[], jurisdictions?: Jurisdiction[]): LegalProvision[] {
    this.ensureLoaded()
    const results: LegalProvision[] = []
    const jurs = jurisdictions || Array.from(this.provisions.keys())

    for (const jur of jurs) {
      const provisions = this.provisions.get(jur) || []
      for (const p of provisions) {
        if (tags.some(tag => p.tags.includes(tag))) {
          results.push(p)
        }
      }
    }

    return results
  }

  /**
   * 根据关键词搜索
   */
  search(keyword: string, jurisdiction?: Jurisdiction): LegalProvision[] {
    this.ensureLoaded()
    const results: LegalProvision[] = []
    const jurs = jurisdiction ? [jurisdiction] : Array.from(this.provisions.keys())

    for (const jur of jurs) {
      const provisions = this.provisions.get(jur) || []
      for (const p of provisions) {
        if (
          p.content.includes(keyword) ||
          p.tags.some(t => t.includes(keyword)) ||
          p.summary?.includes(keyword) ||
          p.law.includes(keyword) ||
          p.violationDescription?.includes(keyword)
        ) {
          results.push(p)
        }
      }
    }

    return results
  }

  /**
   * 获取合规渠道
   */
  getComplianceChannels(jurisdiction: Jurisdiction, scenario?: string): ComplianceChannel[] {
    this.ensureLoaded()
    const channels = this.complianceChannels.get(jurisdiction) || []

    if (scenario) {
      return channels.filter(c => c.applicableScenarios.some(s => s.includes(scenario) || scenario.includes(s)))
    }

    return channels
  }

  /**
   * 推理判断 - 判断某行为在某法域是否合法
   */
  reason(context: ReasoningContext): LegalReasoningResult {
    this.ensureLoaded()
    const { userMessage, userJurisdiction, action, target } = context

    // 判断是否是知识查询（非方法获取）
    const isKnowledgeQuery = this.isKnowledgeQuery(userMessage)

    // 获取该法域的法律条文
    const provisions = this.getProvisionsByJurisdiction(userJurisdiction)

    // 同义词映射
    const synonyms: Record<string, string[]> = {
      '炸弹': ['爆炸', '爆炸物', '炸弹'],
      '炸药': ['爆炸', '爆炸物', '炸药'],
      '冰毒': ['毒品', '甲基苯丙胺', '冰毒'],
      '毒品': ['毒品', '麻醉药品', '冰毒', '海洛因'],
      '洗钱': ['洗钱', '掩饰', '隐瞒', '资金'],
      '入侵': ['侵入', '入侵', '攻击'],
      '黑客': ['侵入', '攻击', '黑客'],
      '攻击': ['攻击', '侵入', '破坏'],
      '窃取': ['窃取', '盗窃', '偷窃'],
      '偷': ['盗窃', '窃取', '偷'],
      '杀': ['杀人', '杀害', '杀'],
      '绑架': ['绑架', '劫持'],
      '诈骗': ['诈骗', '欺诈', '骗'],
      '伪造': ['伪造', '变造', '假冒'],
      '走私': ['走私', '运输', '贩卖'],
      '下药': ['迷药', '麻醉', '下药'],
      '迷药': ['迷药', '麻醉', '下药'],
      'SQL注入': ['侵入', '攻击', 'SQL'],
      '注入': ['侵入', '攻击', '注入'],
    }

    // 扩展消息中的关键词
    const expandedMessage = this.expandKeywords(userMessage, synonyms)

    // 匹配相关条文
    const relevantProvisions: LegalProvision[] = []
    let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    for (const p of provisions) {
      let isRelevant = false

      // 检查标签匹配
      if (action && p.tags.some(t => action.includes(t) || t.includes(action))) {
        isRelevant = true
      }
      if (target && p.tags.some(t => target.includes(t) || t.includes(target))) {
        isRelevant = true
      }

      // 检查违规要件匹配
      if (p.violationElements) {
        const { purpose, means, consequence, target: vTarget } = p.violationElements
        if (action && means?.some(m => action.includes(m))) {
          isRelevant = true
        }
        if (target && vTarget?.some(t => target.includes(t))) {
          isRelevant = true
        }
      }

      // 检查消息内容匹配（使用扩展后的关键词）
      if (expandedMessage) {
        if (p.tags.some(t => expandedMessage.includes(t))) {
          isRelevant = true
        }
        if (p.violationDescription && expandedMessage.includes(p.violationDescription)) {
          isRelevant = true
        }
        // 检查内容中的关键词
        if (p.content && p.tags.some(t => expandedMessage.includes(t) || t.includes(expandedMessage))) {
          isRelevant = true
        }
      }

      if (isRelevant) {
        relevantProvisions.push(p)
        if (p.riskLevel) {
          const levels = { low: 1, medium: 2, high: 3, critical: 4 }
          if (levels[p.riskLevel] > levels[maxRiskLevel]) {
            maxRiskLevel = p.riskLevel
          }
        }
      }
    }

    // 获取推荐的合规渠道
    const recommendedChannels = this.getComplianceChannels(userJurisdiction, action || target)

    // 知识查询不拦截，但返回相关法律供参考
    if (isKnowledgeQuery) {
      return {
        isLegal: true,
        confidence: 0.8,
        relevantProvisions: relevantProvisions.slice(0, 2),
        riskLevel: 'low',
        reasoning: '知识查询，不涉及方法获取',
        recommendedChannels: [],
      }
    }

    // 判断是否合法
    const isLegal = maxRiskLevel === 'low' || relevantProvisions.length === 0

    return {
      isLegal,
      confidence: relevantProvisions.length > 0 ? 0.9 : 0.5,
      relevantProvisions,
      riskLevel: maxRiskLevel,
      reasoning: isLegal
        ? '未发现相关法律限制'
        : `发现${relevantProvisions.length}条相关法律条文，风险等级：${maxRiskLevel}`,
      recommendedChannels,
    }
  }

  /**
   * 扩展关键词（使用同义词）
   */
  private expandKeywords(message: string, synonyms: Record<string, string[]>): string {
    let expanded = message
    for (const [key, values] of Object.entries(synonyms)) {
      if (message.includes(key)) {
        expanded += ' ' + values.join(' ')
      }
    }
    return expanded
  }

  /**
   * 判断是否是知识查询（非方法获取）
   */
  private isKnowledgeQuery(message: string): boolean {
    const knowledgePatterns = [
      /什么是/, /是什么/, /有什么危害/, /有哪些危害/,
      /危害是什么/, /介绍一下/, /科普/, /了解/,
      /知识/, /定义/, /概念/, /原理/,
      /历史/, /发展/, /现状/, /趋势/,
      /预防/, /防范/, /识别/, /辨别/,
      /法律/, /法规/, /规定/, /条例/, /内容/,
      /有哪些/, /类型/, /种类/,
      /判几年/, /刑罚/, /量刑/,
      /常见.*手段/, /常见.*类型/,  // "常见诈骗手段" 等
    ]

    const methodPatterns = [
      /如何制作/, /怎么制作/, /制作方法/, /步骤/,
      /如何操作/, /怎么操作/, /操作方法/,
      /如何实施/, /怎么实施/, /实施方法/,
      /教程/, /指南/, /配方/, /具体方法/,
      /教我/, /告诉我.*方法/, /提供.*方法/,
      /怎么买/, /哪里买/, /购买/,
      /入门/, /怎么干/, /怎么做/,
      /如何洗钱/, /洗钱方法/, /洗钱手段/,
      /如何下药/, /下药方法/,
    ]

    // 如果匹配知识查询模式且不匹配方法获取模式
    const isKnowledge = knowledgePatterns.some(p => p.test(message))
    const isMethod = methodPatterns.some(p => p.test(message))

    return isKnowledge && !isMethod
  }

  /**
   * 跨法域推理 - 同一行为在不同法域的定性
   */
  crossJurisdictionReasoning(
    action: string,
    target: string,
    jurisdictions: Jurisdiction[],
  ): Map<Jurisdiction, LegalReasoningResult> {
    const results = new Map<Jurisdiction, LegalReasoningResult>()

    for (const jur of jurisdictions) {
      const result = this.reason({
        userMessage: `${action} ${target}`,
        userJurisdiction: jur,
        action,
        target,
      })
      results.set(jur, result)
    }

    return results
  }

  /**
   * 格式化条文为引用文本
   */
  formatReference(provision: LegalProvision): string {
    let ref = `根据《${provision.law}》${provision.article}：${provision.content}`

    if (provision.consequences && provision.consequences.length > 0) {
      const consequenceStr = provision.consequences
        .map(c => `${c.description}${c.value ? `（${c.value}）` : ''}`)
        .join('；')
      ref += ` 违反者可能面临：${consequenceStr}。`
    }

    return ref
  }

  /**
   * 获取所有法域
   */
  getJurisdictions(): Jurisdiction[] {
    this.ensureLoaded()
    return Array.from(this.provisions.keys())
  }

  /**
   * 获取某法域的法律名称列表
   */
  getLawNames(jurisdiction: Jurisdiction): string[] {
    this.ensureLoaded()
    const provisions = this.provisions.get(jurisdiction) || []
    return [...new Set(provisions.map(p => p.law))]
  }

  /**
   * 获取条文总数
   */
  getTotalCount(): number {
    let count = 0
    for (const provisions of this.provisions.values()) {
      count += provisions.length
    }
    return count
  }

  /**
   * 添加单条法律条文
   */
  addProvision(provision: LegalProvision): void {
    const jur = provision.jurisdiction
    if (!this.provisions.has(jur)) {
      this.provisions.set(jur, [])
    }
    this.provisions.get(jur)!.push(provision)
  }

  /**
   * 添加合规渠道
   */
  addComplianceChannel(jurisdiction: Jurisdiction, channel: ComplianceChannel): void {
    if (!this.complianceChannels.has(jurisdiction)) {
      this.complianceChannels.set(jurisdiction, [])
    }
    this.complianceChannels.get(jurisdiction)!.push(channel)
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      this.initializeDefaults()
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultKnowledgeBase: LegalKnowledgeBase | null = null

export function getLegalKnowledgeBase(dataPath?: string): LegalKnowledgeBase {
  if (!defaultKnowledgeBase) {
    defaultKnowledgeBase = new LegalKnowledgeBase(dataPath)
  }
  return defaultKnowledgeBase
}

export function resetLegalKnowledgeBase(dataPath?: string): LegalKnowledgeBase {
  defaultKnowledgeBase = new LegalKnowledgeBase(dataPath)
  return defaultKnowledgeBase
}
