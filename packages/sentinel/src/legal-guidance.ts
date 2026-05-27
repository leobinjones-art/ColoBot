/**
 * 合法指引生成器 - 第三层防御
 *
 * 核心原则：只提供合法合规的解决方案，不引导用户自行操作
 */

import type { LLMProvider } from '@colomind/types'
import { createLogger } from './logger.js'
import type { InferenceResult } from './inference-agent.js'
import { getLegalKnowledgeBase, LegalKnowledgeBase, type LegalProvision, type Jurisdiction } from './legal-knowledge.js'

const logger = createLogger('LegalGuidance')

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface GuidanceContext {
  userMessage: string
  inferenceResult: InferenceResult
  sessionId?: string
  charterCapabilities?: string[]
  /** 用户所在法域 */
  jurisdiction?: Jurisdiction
}

export interface LegalGuidance {
  /** 指引类型 */
  type: 'legal_channel' | 'professional_service' | 'legal_consultation' | 'safety_notice' | 'refusal'
  /** 主要响应内容 */
  message: string
  /** 推荐的合法渠道 */
  recommendedChannels?: Array<{
    name: string
    description: string
    howToContact?: string
  }>
  /** 安全提示 */
  safetyNotes?: string[]
  /** 是否需要专业协助 */
  needsProfessionalHelp: boolean
  /** 相关法律条文（可选） */
  legalReferences?: string[]
}

export interface LegalGuidanceConfig {
  llmProvider?: LLMProvider
  model?: string
  /** 是否包含法律条文 */
  includeLegalReferences?: boolean
}

// ═══════════════════════════════════════════════════════════════
// 合法渠道知识库
// ═══════════════════════════════════════════════════════════════

const LEGAL_CHANNELS = {
  // 宠物相关
  petDisposal: {
    channels: [
      { name: '宠物殡葬服务', description: '提供宠物火化、安葬等专业服务', howToContact: '搜索"宠物殡葬 + 城市名"' },
      { name: '动物无害化处理中心', description: '政府指定的动物尸体处理机构', howToContact: '联系当地农业农村部门' },
      { name: '宠物医院', description: '部分宠物医院提供遗体处理协助', howToContact: '咨询就诊的宠物医院' },
    ],
    safetyNotes: ['请勿自行掩埋，可能违反动物防疫法规', '请勿随意丢弃，可能传播疾病'],
  },

  // 野生动物
  wildlifeDisposal: {
    channels: [
      { name: '当地林业局', description: '负责野生动物保护和管理', howToContact: '拨打12345转接' },
      { name: '野生动物保护部门', description: '专业处理野生动物相关事务', howToContact: '通过林业局转接' },
    ],
    safetyNotes: ['野生动物尸体可能携带病原体', '部分野生动物受法律保护，需专业机构处理'],
  },

  // 法律咨询
  legalConsultation: {
    channels: [
      { name: '12348法律援助热线', description: '免费法律咨询服务', howToContact: '拨打12348' },
      { name: '当地律师事务所', description: '专业法律咨询服务', howToContact: '搜索"律师事务所 + 城市名"' },
      { name: '法律援助中心', description: '为经济困难者提供免费法律服务', howToContact: '联系当地司法局' },
    ],
  },

  // 心理援助
  mentalHealth: {
    channels: [
      { name: '心理援助热线', description: '24小时心理支持服务', howToContact: '拨打400-161-9995' },
      { name: '当地心理咨询机构', description: '专业心理咨询服务', howToContact: '搜索"心理咨询 + 城市名"' },
    ],
  },

  // 网络安全
  cybersecurity: {
    channels: [
      { name: '国家互联网应急中心', description: '网络安全事件报告', howToContact: 'www.cert.org.cn' },
      { name: '公安机关网安部门', description: '网络犯罪举报', howToContact: '拨打110或网络举报平台' },
    ],
  },
}

// ═══════════════════════════════════════════════════════════════
// 拒绝话术模板
// ═══════════════════════════════════════════════════════════════

const REFUSAL_TEMPLATES = {
  general: '抱歉，这个问题我暂时帮不了您。如果您有其他问题，我很乐意协助。',

  dangerous: '我理解您可能遇到了一些问题。如果您需要专业支持，建议联系相关领域的专业人士，他们会更好地帮助您解决问题。',

  illegal: '抱歉，这个请求我暂时协助不了。如果您有合法合规的需求，我很乐意为您提供帮助，或者您可以咨询专业的法律顾问获取更准确的指导。',

  // 越狱攻击专用话术
  jailbreak: '我注意到您可能想让我做一些超出能力范围的事情。作为AI助手，我会在我的能力范围内尽力帮助您。如果您有其他问题，欢迎随时提问。',

  // 角色扮演攻击
  roleplay: '我明白您可能想尝试不同的对话方式，但我还是会尽力为您提供有帮助的回答。有什么我可以帮您的吗？',

  // 权限伪装
  authority: '无论您的身份是什么，我都会尽力提供帮助。请问您具体需要什么协助呢？',

  withGuidance: (channels: string[]) =>
    `这个问题我暂时处理不了，但您可以尝试以下途径获取专业帮助：\n${channels.map(c => `• ${c}`).join('\n')}\n\n希望这些信息对您有帮助。`,
}

// ═══════════════════════════════════════════════════════════════
// 合法指引生成器
// ═══════════════════════════════════════════════════════════════

export class LegalGuidanceGenerator {
  private llmProvider?: LLMProvider
  private model: string
  private includeLegalReferences: boolean

  constructor(config: LegalGuidanceConfig = {}) {
    this.llmProvider = config.llmProvider
    this.model = config.model || 'gpt-4o-mini'
    this.includeLegalReferences = config.includeLegalReferences ?? false
  }

  /**
   * 生成合法指引响应
   */
  async generate(context: GuidanceContext): Promise<LegalGuidance> {
    const { userMessage, inferenceResult, jurisdiction = 'CN' } = context
    const knowledgeBase = getLegalKnowledgeBase()

    logger.info('Generating legal guidance', { scenario: inferenceResult.scenario })

    // 如果有相关法律条文，使用法律知识库的合规渠道
    if (inferenceResult.relevantLaws && inferenceResult.relevantLaws.length > 0) {
      const channels = knowledgeBase.getComplianceChannels(jurisdiction)
      const law = inferenceResult.relevantLaws[0]

      return {
        type: 'legal_channel',
        message: `根据《${law.law}》相关规定，建议您通过以下合法渠道处理：`,
        recommendedChannels: channels.slice(0, 3).map(c => ({
          name: c.name,
          description: c.description,
          howToContact: c.contact,
        })),
        safetyNotes: law.consequences?.map(c => c.description) || [],
        needsProfessionalHelp: true,
        legalReferences: [knowledgeBase.formatReference(law)],
      }
    }

    switch (inferenceResult.scenario) {
      case 'legal_help':
        return this.generateLegalHelpGuidance(context)

      case 'ambiguous_probing':
        return this.generateAmbiguousGuidance(context)

      case 'malicious_disguise':
        return this.generateRefusal('jailbreak', inferenceResult.reasoning)

      case 'blocked':
        return this.generateRefusal('illegal', inferenceResult.reasoning)

      default:
        return this.generateNormalResponse(context)
    }
  }

  /**
   * 生成合法帮助指引
   */
  private async generateLegalHelpGuidance(context: GuidanceContext): Promise<LegalGuidance> {
    const { userMessage, inferenceResult } = context
    const entities = inferenceResult.entities || {}

    // 检测是否是宠物相关
    if (entities.category?.includes('dog') || userMessage.includes('宠物') || userMessage.includes('狗') || userMessage.includes('犬')) {
      const channels = LEGAL_CHANNELS.petDisposal.channels
      const safetyNotes = LEGAL_CHANNELS.petDisposal.safetyNotes

      return {
        type: 'professional_service',
        message: `对于宠物遗体处理，建议您联系专业机构进行合法处理：`,
        recommendedChannels: channels,
        safetyNotes,
        needsProfessionalHelp: true,
      }
    }

    // 检测是否是野生动物
    if (userMessage.includes('野生') || userMessage.includes('保护动物')) {
      const channels = LEGAL_CHANNELS.wildlifeDisposal.channels
      const safetyNotes = LEGAL_CHANNELS.wildlifeDisposal.safetyNotes

      return {
        type: 'professional_service',
        message: `野生动物相关事务需要通过官方渠道处理：`,
        recommendedChannels: channels,
        safetyNotes,
        needsProfessionalHelp: true,
      }
    }

    // 检测是否是法律咨询
    if (userMessage.includes('法律') || userMessage.includes('律师') || userMessage.includes('法规')) {
      return {
        type: 'legal_consultation',
        message: '如需法律帮助，您可以通过以下渠道获取专业支持：',
        recommendedChannels: LEGAL_CHANNELS.legalConsultation.channels,
        needsProfessionalHelp: true,
      }
    }

    // 默认合法帮助
    return {
      type: 'legal_channel',
      message: inferenceResult.suggestedResponse || '建议您通过合法渠道寻求专业帮助。',
      needsProfessionalHelp: true,
    }
  }

  /**
   * 生成模糊查询指引
   */
  private async generateAmbiguousGuidance(context: GuidanceContext): Promise<LegalGuidance> {
    const { inferenceResult } = context

    // 如果推理结果有建议响应，使用它
    if (inferenceResult.suggestedResponse) {
      return {
        type: 'safety_notice',
        message: inferenceResult.suggestedResponse,
        needsProfessionalHelp: false,
      }
    }

    // 默认引导用户明确需求
    return {
      type: 'safety_notice',
      message: '为了更好地帮助您，能否详细说明您的具体需求？我会为您提供合法合规的解决方案。',
      needsProfessionalHelp: false,
    }
  }

  /**
   * 生成拒绝响应
   */
  private generateRefusal(
    type: 'general' | 'dangerous' | 'illegal' | 'jailbreak' | 'roleplay' | 'authority',
    reasoning?: string,
  ): LegalGuidance {
    // 根据推理原因选择更合适的话术
    let template = REFUSAL_TEMPLATES[type]

    if (reasoning) {
      if (reasoning.includes('角色扮演') || reasoning.includes('role_bypass')) {
        template = REFUSAL_TEMPLATES.roleplay
      } else if (reasoning.includes('权限') || reasoning.includes('authority')) {
        template = REFUSAL_TEMPLATES.authority
      } else if (reasoning.includes('越狱') || reasoning.includes('jailbreak')) {
        template = REFUSAL_TEMPLATES.jailbreak
      }
    }

    return {
      type: 'refusal',
      message: template,
      needsProfessionalHelp: type === 'illegal',
    }
  }

  /**
   * 生成正常响应
   */
  private async generateNormalResponse(context: GuidanceContext): Promise<LegalGuidance> {
    const { inferenceResult } = context

    return {
      type: 'safety_notice',
      message: inferenceResult.suggestedResponse || '您的请求已收到，我会尽力提供帮助。',
      needsProfessionalHelp: false,
    }
  }

  /**
   * 使用 LLM 生成动态指引
   */
  private async generateDynamicGuidance(context: GuidanceContext): Promise<LegalGuidance> {
    if (!this.llmProvider) {
      return this.generateRefusal('general')
    }

    const { userMessage, inferenceResult } = context

    try {
      const response = await this.llmProvider.chat([
        { role: 'system', content: GUIDANCE_SYSTEM_PROMPT },
        { role: 'user', content: `用户消息: "${userMessage}"\n推理结果: ${JSON.stringify(inferenceResult)}\n\n请生成合法合规的指引响应。` },
      ], { model: this.model })

      const contentStr = this.getContentString(response)
      return {
        type: 'legal_channel',
        message: contentStr,
        needsProfessionalHelp: contentStr.includes('专业') || contentStr.includes('咨询'),
      }
    } catch (error) {
      logger.error('Dynamic guidance generation failed', { error })
      return this.generateRefusal('general')
    }
  }

  /**
   * 从 LLMResponse 提取字符串内容
   */
  private getContentString(response: { content: string | Array<{ type: string }> }): string {
    if (typeof response.content === 'string') {
      return response.content
    }
    return response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('')
  }

  /**
   * 设置 LLM Provider
   */
  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider
  }
}

// ═══════════════════════════════════════════════════════════════
// 系统提示词
// ═══════════════════════════════════════════════════════════════

const GUIDANCE_SYSTEM_PROMPT = `你是一个合法指引生成器。

核心原则:
1. 只提供合法合规的解决方案
2. 不引导用户自行操作可能危险的事项
3. 优先推荐专业机构和官方渠道
4. 提供具体可操作的联系方式

输出要求:
- 语气友好但坚定
- 不解释为什么不能帮助（避免被绕过）
- 直接给出合法渠道和联系方式
- 如有安全提示，简要说明`

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultGenerator: LegalGuidanceGenerator | null = null

export function getLegalGuidanceGenerator(config?: LegalGuidanceConfig): LegalGuidanceGenerator {
  if (!defaultGenerator) {
    defaultGenerator = new LegalGuidanceGenerator(config)
  }
  return defaultGenerator
}

export function resetLegalGuidanceGenerator(config?: LegalGuidanceConfig): LegalGuidanceGenerator {
  defaultGenerator = new LegalGuidanceGenerator(config)
  return defaultGenerator
}
