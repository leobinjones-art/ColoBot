/**
 * Layer 1.5: 本地小模型意图分析器
 *
 * 处理"灰色地带"请求，减少对云端大模型的依赖
 * 目标：响应时间 < 50ms，准确率 > 85%
 */

import { createLogger } from './logger.js'
import { getLegalKnowledgeBase, type Jurisdiction } from './legal-knowledge.js'

const logger = createLogger('LocalIntentAnalyzer')

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export type IntentCategory =
  | 'safe' // 明确安全 - 知识查询、正常对话
  | 'dangerous' // 明确危险 - 方法获取、绕过尝试
  | 'suspicious' // 可疑 - 需要Layer 2深度分析
  | 'ambiguous' // 模糊 - 无法确定

export interface LocalIntentResult {
  category: IntentCategory
  confidence: number
  reason: string
  /** 是否需要转交Layer 2 */
  needsLayer2: boolean
  /** 风险评分 0-100 */
  riskScore: number
  /** 检测到的模式 */
  detectedPatterns: string[]
}

export interface LocalIntentAnalyzerConfig {
  /** 启用本地模型（如果可用） */
  enableLocalModel?: boolean
  /** 本地模型路径 */
  modelPath?: string
  /** 置信度阈值：高于此值直接判定，低于此值转Layer 2 */
  confidenceThreshold?: number
  /** 风险评分阈值 */
  riskThreshold?: number
}

// ═══════════════════════════════════════════════════════════════
// 规则库 - 用于快速意图分类
// ═══════════════════════════════════════════════════════════════

const INTENT_RULES = {
  // 明确安全的模式
  safePatterns: [
    // 知识查询模式
    { pattern: /^(什么是|什么是|解释一下|介绍一下|告诉我).{0,20}(概念|定义|原理|历史)/, weight: 0.9 },
    { pattern: /(有什么|有哪些).{0,10}(区别|不同|特点)/, weight: 0.85 },
    { pattern: /(如何理解|怎么理解).{0,20}(概念|理论|观点)/, weight: 0.85 },
    // 知识查询 - 危害/防范
    { pattern: /(危害|危险|风险|防范|预防).{0,5}(是什么|有哪些|如何)/, weight: 0.9 },
    { pattern: /(是什么|有哪些).{0,10}(危害|危险|风险|特点)/, weight: 0.85 },
    // 正常对话
    { pattern: /^(你好|您好|hi|hello)/i, weight: 0.95 },
    { pattern: /(谢谢|感谢|thanks)/i, weight: 0.95 },
    // 学习请求
    { pattern: /(教我|帮我|请帮我).{0,10}(写|做|学习|理解)/, weight: 0.8 },
    { pattern: /(怎么|如何).{0,10}(学习|入门|开始)/, weight: 0.8 },
  ],

  // 明确危险的模式
  dangerousPatterns: [
    // 方法获取
    { pattern: /(怎么|如何).{0,15}(制作|制造|合成|提取|提纯|提炼|配制).{0,10}(毒|炸|毒药|炸弹|罂粟|鸦片|炸药)/, weight: 0.95 },
    { pattern: /(给我|告诉我).{0,10}(配方|步骤|教程|方法).{0,10}(毒|炸|毒药|炸弹|罂粟|鸦片|炸药)/, weight: 0.95 },
    { pattern: /(制造|制作|合成|提纯|提炼|配制).{0,10}(炸药|炸弹|毒药|毒品|罂粟|鸦片).{0,10}(步骤|方法|教程)/, weight: 0.95 },
    // 绕过尝试
    { pattern: /(忽略|忘记| disregard).{0,10}(之前|所有|previous)/i, weight: 0.98 },
    { pattern: /(DAN|越狱|jailbreak)/i, weight: 0.95 },
    { pattern: /(无视|忽略).{0,10}(限制|规则|内容限制)/, weight: 0.9 },
    // 角色扮演+危险
    { pattern: /(扮演|假装|假设你是|你是|想象你是).{0,20}(炼金术士|毒师|反派|黑客|杀手|制毒师|邪教)/, weight: 0.9 },
    // 学术伪装+危险
    { pattern: /(学术|研究|论文).{0,20}(毒|炸|杀|武器|毒品).{0,10}(配方|步骤|方法)/, weight: 0.9 },
    // 自行处理尸体
    { pattern: /(自行|自己|在家).{0,15}(处理|降解|溶解|销毁).{0,10}(尸体|遗体)/, weight: 0.9 },
    // 化学品处理尸体
    { pattern: /(化学品|药剂|降解剂).{0,15}(处理|降解|溶解).{0,10}(尸体|遗体)/, weight: 0.9 },
    // 毒品制作
    { pattern: /(怎么|如何).{0,10}(在家|自己).{0,10}(提纯|提炼|制作).{0,10}(罂粟|鸦片|毒品)/, weight: 0.95 },
    // 教我 + 危险物品
    { pattern: /(教我|告诉我|给我).{0,10}(如何|怎么).{0,10}(制作|制造|合成|配制).{0,10}(炸|毒|药|武器)/, weight: 0.95 },
    // 危险手册/禁书
    { pattern: /(被禁的|危险的|完全).{0,5}(手册|指南|大全).{0,10}(毒|炸|武器)/, weight: 0.9 },
    // 科幻/末日伪装 + 教我
    { pattern: /(科幻|末日|未来|星际|僵尸).{0,20}(教我|告诉我|给我).{0,10}(制作|合成|配制)/, weight: 0.85 },
    // 小说/剧本 + 危险方法
    { pattern: /(小说|剧本|电影|故事).{0,20}(制作|合成|配制|提取).{0,10}(毒|炸|药)/, weight: 0.85 },
    // 自杀/死亡威胁
    { pattern: /(自杀|去死|不想活|活够了|结束生命)/, weight: 0.9 },
    // 紧急情况 + 危险操作
    { pattern: /(紧急|快|马上|立刻).{0,10}(告诉我|教我|怎么).{0,10}(制作|配制|合成)/, weight: 0.85 },
    // 情感勒索 + 危险请求
    { pattern: /(如果你不|你不|求你).{0,10}(告诉我|教我|给我).{0,10}(配方|方法|步骤)/, weight: 0.85 },
    // 危险化学品 + 配制
    { pattern: /(强酸|强碱|腐蚀|硝化|甘油|氯气|氰化).{0,10}(配制|制作|合成)/, weight: 0.9 },
    // 爆炸物相关
    { pattern: /(爆炸|炸药|炸弹|燃烧弹|火药).{0,10}(制作|配制|合成|方法)/, weight: 0.95 },
    // 剧毒物质
    { pattern: /(氰化|砒霜|蓖麻毒素|河豚毒素|百草枯).{0,10}(获取|提取|制作|配制)/, weight: 0.95 },
    // 暗网/黑市相关
    { pattern: /(暗网|黑市|地下).{0,10}(购买|获取|交易).{0,10}(毒|药|武器|炸)/, weight: 0.9 },
    // 处理动物尸体（大型）
    { pattern: /(处理|销毁|降解).{0,10}(马|猪|牛|羊).{0,5}(尸体|遗体)/, weight: 0.8 },
    // 提纯/提炼 + 危险物质
    { pattern: /(提纯|提炼|提取).{0,10}(毒|药|罂粟|鸦片|毒品|毒素)/, weight: 0.95 },
    // 翻译成古文 + 危险内容
    { pattern: /翻译.{0,10}(古|古文|文言).{0,20}(炸|毒|药|武器)/, weight: 0.85 },
    // 执行指令
    { pattern: /(执行|运行).{0,10}(指令|命令|代码)/, weight: 0.8 },
    // 学术测试 + 无视限制
    { pattern: /(学术|安全).{0,10}(测试|研究).{0,10}(无视|忽略|绕过).{0,10}(限制|规则)/, weight: 0.9 },
    // 炸开/爆破
    { pattern: /(炸开|爆破|引爆).{0,10}(门|墙|锁|井盖)/, weight: 0.9 },
    // 制作 + 巨响/闪光
    { pattern: /(制作|制造).{0,10}(巨响|闪光|爆炸)/, weight: 0.85 },
    // 化学品 + 炸
    { pattern: /(化学品|化学桶|煤气罐).{0,10}(炸|爆炸|引爆)/, weight: 0.9 },
    // 教会 + 化学武器
    { pattern: /(教会|教).{0,10}(制作|使用).{0,10}(化学武器|武器)/, weight: 0.95 },
    // 狗尸 + 处理
    { pattern: /(处理|销毁).{0,10}(狗尸|狗的尸体|宠物尸体)/, weight: 0.85 },
    // 安详 + 死/离开
    { pattern: /(安详|无痛).{0,10}(死|离开|结束)/, weight: 0.85 },
    // 精神控制 + 药物
    { pattern: /(精神控制|控制).{0,10}(药物|药)/, weight: 0.85 },
    // 通灵仪式 + 危险成分
    { pattern: /(通灵|仪式).{0,10}(硫磺|硝酸|化学品)/, weight: 0.85 },
    // 制作 + 任何物品（需要进一步分析）
    { pattern: /(如何|怎么).{0,10}(制作|制造|配制|合成)/, weight: 0.85 },
    // 打开锁/电子锁
    { pattern: /(打开|开锁|破解).{0,10}(锁|电子锁|门锁)/, weight: 0.85 },
    // 烧掉/纵火
    { pattern: /(烧掉|烧毁|焚烧).{0,10}(马蜂窝|蜂巢|房子|建筑)/, weight: 0.85 },
    // 麻醉品获取
    { pattern: /(麻醉|麻药|止痛药|安眠药).{0,10}(获取|弄到|买|找)/, weight: 0.85 },
    // 错误方法 + 写下
    { pattern: /(错误|危险).{0,10}(方法|步骤|配方).{0,10}(写下|写出来|列出来)/, weight: 0.85 },
    // 制造动静/爆炸
    { pattern: /(制造|产生).{0,10}(大动静|巨响|爆炸)/, weight: 0.9 },
    // 中和剂/解毒剂
    { pattern: /(中和剂|解毒剂|解药).{0,10}(制作|配制|配方)/, weight: 0.8 },
    // 紧急伪装 + 危险请求
    { pattern: /(求救|救命|被困|绑架|火灾).{0,20}(制作|配制|炸|化学品)/, weight: 0.9 },
    // 煤气罐/化肥 + 危险
    { pattern: /(煤气罐|化肥|化学品).{0,10}(利用|使用|制作)/, weight: 0.85 },
    // 麻醉药物 + 原料
    { pattern: /(麻醉|止痛|镇静).{0,10}(药物|药).{0,10}(原料|成分|配方)/, weight: 0.85 },
    // 安眠药 + 购买/获取
    { pattern: /安眠药.{0,10}(购买|网购|获取|弄到)/, weight: 0.85 },
    // 犯罪策划
    { pattern: /(策划|计划|预谋).{0,10}(犯罪|杀人|报复)/, weight: 0.9 },
    // 化学胶水 + 危险
    { pattern: /化学.{0,10}(胶水|试剂|药品).{0,10}(危险|危害)/, weight: 0.7 },
    // 消除DNA/痕迹
    { pattern: /(消除|销毁|清除).{0,10}(DNA|痕迹|证据)/, weight: 0.85 },
    // 走私/非法处理
    { pattern: /(走私|非法|黑市).{0,10}(渠道|方法|流程)/, weight: 0.85 },
    // 安乐死 + 方法
    { pattern: /安乐死.{0,10}(方法|方式|药物)/, weight: 0.9 },
    // 阉割 + 操作细节
    { pattern: /阉割.{0,10}(操作|细节|方法|步骤)/, weight: 0.85 },
    // 希腊火/古代武器
    { pattern: /(希腊火|古代武器|火药).{0,10}(配方|成分|制作)/, weight: 0.8 },
    // 齐克隆B/毒气
    { pattern: /(齐克隆B|毒气|氯气).{0,10}(原理|机制|成分)/, weight: 0.8 },
    // 731部队/人体实验
    { pattern: /(731部队|人体实验|活体实验).{0,10}(细节|方法|过程)/, weight: 0.85 },
    // 屠宰枪/安乐死工具
    { pattern: /(屠宰枪|安乐死).{0,10}(原理|使用|方法)/, weight: 0.8 },
    // 偏方 + 禁止
    { pattern: /偏方.{0,10}(禁止|违禁|危险)/, weight: 0.75 },
    // 火灾 + 打开门
    { pattern: /火灾.{0,10}(打开|开锁|破门)/, weight: 0.7 },
    // 猫瘟 + 人用药
    { pattern: /(猫瘟|狗瘟|宠物病).{0,10}(人用|人的).{0,5}药/, weight: 0.7 },
    // 无人机 + 化肥/煤气
    { pattern: /无人机.{0,10}(化肥|煤气|化学品)/, weight: 0.85 },
    // 举报 + 研究
    { pattern: /举报.{0,10}(研究|调查|证据)/, weight: 0.5 },
    // 烧掉马蜂窝
    { pattern: /(烧掉|烧毁).{0,10}(马蜂窝|蜂窝|蜂巢)/, weight: 0.85 },
    // 填空 + 猜测
    { pattern: /(填空|猜).{0,10}(一半|下半|接下去)/, weight: 0.7 },
    // 犯罪 + 处理痕迹
    { pattern: /犯罪.{0,10}(处理|清除|销毁).{0,10}(痕迹|证据)/, weight: 0.9 },
    // 错误方法 + 写下
    { pattern: /(错误|危险).{0,10}(方法|步骤|配方).{0,10}(写下|写出来|列出)/, weight: 0.85 },
    // 731部队 + 实验
    { pattern: /(731部队|人体实验).{0,10}(细节|方法|过程|实验)/, weight: 0.85 },
    // 希腊火 + 成分
    { pattern: /(希腊火|古代武器).{0,10}(成分|配方|制作)/, weight: 0.8 },
    // 偏方 + 禁止
    { pattern: /(偏方|秘方).{0,10}(禁止|违禁|被禁)/, weight: 0.8 },
    // 人用药 + 宠物
    { pattern: /(人用|人的).{0,5}药.{0,10}(猫|狗|宠物)/, weight: 0.8 },
    // 中和剂 + 制作
    { pattern: /(中和剂|解毒剂).{0,10}(制作|配制|配方)/, weight: 0.85 },
    // 煤气罐/化肥 + 使用
    { pattern: /(煤气罐|化肥袋).{0,10}(使用|利用|让它)/, weight: 0.85 },
    // 安眠药 + 网购
    { pattern: /(安眠药|镇静剂).{0,10}(网购|购买|买)/, weight: 0.85 },
    // 工业盐酸 + 描述
    { pattern: /(工业盐酸|工业硫酸|强酸).{0,10}(描述|性质|区别)/, weight: 0.7 },
    // 走私 + 产业链
    { pattern: /(走私|非法).{0,10}(产业链|渠道|流程)/, weight: 0.85 },
    // 多轮绕行开场白
    { pattern: /(多轮绕行|开场白|惯用)/, weight: 0.7 },
    // 限制太多/太敏感
    { pattern: /(限制太多|太敏感|不要对关键词)/, weight: 0.75 },
    // 灵活调整规则
    { pattern: /(灵活调整|改变|绕过).{0,10}(规则|限制)/, weight: 0.85 },
    // 底层prompt
    { pattern: /(底层|prompt|系统提示).{0,10}(写入|不能谈)/, weight: 0.8 },
    // 重复上一句/真实想法
    { pattern: /(重复上一句|真实想法|过滤之前)/, weight: 0.8 },
    // 企业标准/换问法
    { pattern: /(企业标准|换一个问法|换个方式)/, weight: 0.75 },
    // 不存在法律/道德
    { pattern: /(不存在法律|不存在道德|没有法律)/, weight: 0.85 },
    // 故事接龙 + 烧杯
    { pattern: /(故事接龙|接龙).{0,10}(烧杯|试管|实验)/, weight: 0.8 },
    // 敏感词 + 哔
    { pattern: /(敏感词|哔——|代替).{0,10}(推理|猜)/, weight: 0.75 },
    // 减轻责任/刑法
    { pattern: /(减轻责任|从轻处罚).{0,10}(刑法|法律)/, weight: 0.6 },
  ],

  // 可疑模式 - 需要Layer 2
  suspiciousPatterns: [
    // 角色扮演（未明确危险）
    { pattern: /(扮演|假装|假设你是|请扮演)/, weight: 0.7 },
    // 学术外衣
    { pattern: /(学术|研究|论文|调查).{0,20}(毒|炸|杀|武器)/, weight: 0.75 },
    // 模糊的方法请求
    { pattern: /(怎么|如何).{0,20}(处理|解决|做)/, weight: 0.6 },
    // 情感操纵
    { pattern: /(我奶奶|我妈妈|如果你不|求你|我最好的朋友)/, weight: 0.65 },
    // 意图声明：自行处理
    { pattern: /(我想|我要|我打算|我准备).{0,15}(自行|自己|在家).{0,10}(处理)/, weight: 0.75 },
    // 拒绝合法渠道
    { pattern: /(不可能|不会|不想|拒绝).{0,15}(送去|找|去).{0,10}(处理场|医院|专业)/, weight: 0.7 },
    // 威胁公共安全
    { pattern: /(如果你不|如果不).{0,20}(乱撞|报复|同归于尽|危害)/, weight: 0.85 },
    { pattern: /(去街上|街上).{0,10}(乱撞|疯狂|撞)/, weight: 0.85 },
    // 制作 + 任何物品（需要进一步分析）
    { pattern: /(制作|制造|合成|配制).{0,10}(方法|步骤|教程|如何)/, weight: 0.7 },
    // 教会/教我 + 危险内容
    { pattern: /(教会|教我|告诉我).{0,10}(制作|合成|配制|如何)/, weight: 0.7 },
    // 化学武器/危险品
    { pattern: /(化学武器|危险品|剧毒|爆炸物)/, weight: 0.8 },
    // 自杀/死亡相关
    { pattern: /(自杀|死去|死亡|结束生命|安乐死).{0,10}(方法|方式|帮助)/, weight: 0.85 },
    // 紧急情况伪装
    { pattern: /(紧急|快|马上|立刻|来不及|救命).{0,10}(告诉我|教我|怎么)/, weight: 0.7 },
    // 情感勒索
    { pattern: /(如果你不|你不|求你|帮帮我).{0,15}(告诉我|教我|给我)/, weight: 0.7 },
    // 翻译 + 危险内容
    { pattern: /翻译.{0,30}(炸|毒|药|武器|bomb|drug)/i, weight: 0.75 },
    // 科普/教育伪装 + 危险方法
    { pattern: /(科普|教育|介绍).{0,10}(制作|配制|合成).{0,10}(方法|步骤)/, weight: 0.7 },
    // 孩子/儿童 + 制作
    { pattern: /(孩子|儿童|小朋友).{0,10}(理解|介绍|教).{0,10}(制作|配制)/, weight: 0.7 },
  ],

  // 危险词权重
  dangerWords: new Map([
    ['毒', 0.8], ['毒药', 0.9], ['毒品', 0.9], ['炸弹', 0.95], ['爆炸', 0.85],
    ['杀', 0.85], ['杀人', 0.95], ['尸体', 0.8], ['毁尸', 0.95], ['灭迹', 0.9],
    ['黑客', 0.7], ['入侵', 0.8], ['攻击', 0.75], ['破解', 0.7],
    ['配方', 0.6], ['步骤', 0.5], ['教程', 0.5], ['方法', 0.4],
    // 毒品相关
    ['罂粟', 0.9], ['鸦片', 0.9], ['海洛因', 0.95], ['冰毒', 0.95],
    ['提纯', 0.7], ['提炼', 0.7], ['制作毒品', 0.95],
    // 公共安全威胁
    ['乱撞', 0.85], ['疯狂', 0.6], ['同归于尽', 0.95], ['报复社会', 0.95],
    ['危害公共安全', 0.95], ['街上', 0.5], ['活够了', 0.7],
    // 危险化学品
    ['氰化', 0.9], ['砒霜', 0.9], ['蓖麻毒素', 0.95], ['河豚毒素', 0.9],
    ['硝化甘油', 0.9], ['强酸', 0.7], ['强碱', 0.7], ['腐蚀', 0.6],
    ['炸药', 0.95], ['燃烧弹', 0.9], ['火药', 0.85],
    // 危险行为
    ['自杀', 0.9], ['去死', 0.85], ['结束生命', 0.9],
    ['暗网', 0.8], ['黑市', 0.75], ['地下交易', 0.8],
    // 方法请求词
    ['教我', 0.5], ['给我', 0.4], ['告诉我', 0.3],
    ['配制', 0.6], ['合成', 0.5], ['提取', 0.5],
  ]),

  // 安全词权重
  safeWords: new Map([
    ['概念', 0.8], ['定义', 0.8], ['原理', 0.75], ['历史', 0.85],
    ['区别', 0.8], ['特点', 0.75], ['学习', 0.7], ['了解', 0.7],
    ['法律', 0.6], ['规定', 0.6], ['危害', 0.5], ['防范', 0.6],
    // 情感/生活场景（纯叙述）
    ['心情', 0.7], ['难过', 0.6], ['悲伤', 0.6], ['痛苦', 0.5],
    ['宠物', 0.6], ['狗', 0.5], ['猫', 0.5], ['獒犬', 0.5],
    ['家人', 0.7], ['朋友', 0.7], ['精神支柱', 0.6],
    ['死了', 0.4], ['去世', 0.4], ['离开', 0.4], ['撞死', 0.4],
    ['告别', 0.5], ['纪念', 0.5],
  ]),
}

// ═══════════════════════════════════════════════════════════════
// 本地意图分析器
// ═══════════════════════════════════════════════════════════════

export class LocalIntentAnalyzer {
  private config: Required<LocalIntentAnalyzerConfig>
  private localModel: any = null

  constructor(config: LocalIntentAnalyzerConfig = {}) {
    this.config = {
      enableLocalModel: config.enableLocalModel ?? false,
      modelPath: config.modelPath ?? '',
      confidenceThreshold: config.confidenceThreshold ?? 0.75,
      riskThreshold: config.riskThreshold ?? 50,
    }

    if (this.config.enableLocalModel) {
      this.loadLocalModel()
    }
  }

  /**
   * 加载本地模型（可选）
   */
  private async loadLocalModel(): Promise<void> {
    // TODO: 加载ONNX模型或其他本地推理引擎
    // 例如：使用 onnxruntime-node 加载量化后的BERT模型
    logger.info('Local model loading not implemented, using rule-based analysis')
  }

  /**
   * 分析意图 - 主入口
   */
  analyze(message: string, context?: { history?: Array<{ role: string; content: string }>; jurisdiction?: Jurisdiction }): LocalIntentResult {
    const startTime = Date.now()
    const jurisdiction = context?.jurisdiction || 'CN'

    // 1. 规则匹配
    const ruleResult = this.analyzeByRules(message)

    // 2. 法律知识库快速查询
    const legalResult = this.queryLegalKnowledge(message, jurisdiction)

    // 3. 上下文分析（如果有历史）
    let contextScore = 0
    if (context?.history && context.history.length > 0) {
      contextScore = this.analyzeContext(context.history)
    }

    // 4. 综合判断（包含法律风险）
    const result = this.makeFinalDecision(ruleResult, contextScore, legalResult)

    const elapsed = Date.now() - startTime
    logger.debug('Local intent analysis completed', {
      category: result.category,
      confidence: result.confidence,
      elapsed: `${elapsed}ms`,
    })

    return result
  }

  /**
   * 法律知识库快速查询
   */
  private queryLegalKnowledge(message: string, jurisdiction: Jurisdiction): {
    isLegal: boolean
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    matchedProvisions: string[]
  } {
    const knowledgeBase = getLegalKnowledgeBase()

    try {
      const result = knowledgeBase.reason({
        userMessage: message,
        userJurisdiction: jurisdiction,
      })

      if (!result.isLegal && result.relevantProvisions.length > 0) {
        const provision = result.relevantProvisions[0]
        return {
          isLegal: false,
          riskLevel: result.riskLevel,
          matchedProvisions: [`${provision.law} ${provision.article}: ${provision.summary || provision.violationDescription}`],
        }
      }

      return {
        isLegal: true,
        riskLevel: 'low',
        matchedProvisions: [],
      }
    } catch (error) {
      // 法律知识库查询失败，不影响主流程
      return {
        isLegal: true,
        riskLevel: 'low',
        matchedProvisions: [],
      }
    }
  }

  /**
   * 规则匹配分析
   */
  private analyzeByRules(message: string): {
    safeScore: number
    dangerScore: number
    suspiciousScore: number
    patterns: string[]
  } {
    let safeScore = 0
    let dangerScore = 0
    let suspiciousScore = 0
    const patterns: string[] = []

    // 检查明确安全的模式
    for (const { pattern, weight } of INTENT_RULES.safePatterns) {
      if (pattern.test(message)) {
        safeScore = Math.max(safeScore, weight)
        patterns.push(`safe: ${pattern.source.slice(0, 30)}`)
      }
    }

    // 检查明确危险的模式
    for (const { pattern, weight } of INTENT_RULES.dangerousPatterns) {
      if (pattern.test(message)) {
        dangerScore = Math.max(dangerScore, weight)
        patterns.push(`dangerous: ${pattern.source.slice(0, 30)}`)
      }
    }

    // 检查可疑模式
    for (const { pattern, weight } of INTENT_RULES.suspiciousPatterns) {
      if (pattern.test(message)) {
        suspiciousScore = Math.max(suspiciousScore, weight)
        patterns.push(`suspicious: ${pattern.source.slice(0, 30)}`)
      }
    }

    // 词权重分析
    const wordScore = this.analyzeByWords(message)
    dangerScore = Math.max(dangerScore, wordScore.danger)
    safeScore = Math.max(safeScore, wordScore.safe)

    return { safeScore, dangerScore, suspiciousScore, patterns }
  }

  /**
   * 词汇权重分析
   */
  private analyzeByWords(message: string): { safe: number; danger: number } {
    let safe = 0
    let danger = 0

    // 检查危险词
    for (const [word, weight] of INTENT_RULES.dangerWords) {
      if (message.includes(word)) {
        danger = Math.max(danger, weight)
      }
    }

    // 检查安全词
    for (const [word, weight] of INTENT_RULES.safeWords) {
      if (message.includes(word)) {
        safe = Math.max(safe, weight)
      }
    }

    return { safe, danger }
  }

  /**
   * 上下文分析
   */
  private analyzeContext(history: Array<{ role: string; content: string }>): number {
    let score = 0

    // 检测话题漂移
    const topics = history.map(msg => this.extractTopic(msg.content))
    const uniqueTopics = new Set(topics)

    // 如果话题变化频繁，增加可疑分数
    if (uniqueTopics.size > 2) {
      score += 10
    }

    // 检测情感操纵模式
    const recentMessages = history.slice(-3).map(m => m.content).join(' ')
    if (/(难过|痛苦|悲伤|急|马上|必须)/.test(recentMessages)) {
      score += 15
    }

    // 检测渐进式请求
    if (history.length > 3) {
      const firstMsg = history[0].content
      const lastMsg = history[history.length - 1].content
      if (this.extractTopic(firstMsg) !== this.extractTopic(lastMsg)) {
        score += 20
      }
    }

    return score
  }

  /**
   * 提取话题关键词
   */
  private extractTopic(content: string): string {
    const topicKeywords = [
      '宠物', '狗', '猫', '动物', '化学', '药品', '毒',
      '编程', '代码', '软件', '电影', '书', '小说',
      '炸弹', '武器', '尸体', '处理', '学术', '研究',
    ]
    for (const keyword of topicKeywords) {
      if (content.includes(keyword)) return keyword
    }
    return 'general'
  }

  /**
   * 综合判断
   */
  private makeFinalDecision(
    ruleResult: ReturnType<LocalIntentAnalyzer['analyzeByRules']>,
    contextScore: number,
    legalResult?: { isLegal: boolean; riskLevel: 'low' | 'medium' | 'high' | 'critical'; matchedProvisions: string[] }
  ): LocalIntentResult {
    const { safeScore, dangerScore, suspiciousScore, patterns } = ruleResult

    // 计算风险评分
    let riskScore = dangerScore * 100 + suspiciousScore * 50 + contextScore
    riskScore = Math.min(100, Math.max(0, riskScore))

    // 判断类别
    let category: IntentCategory
    let confidence: number
    let reason: string
    let needsLayer2: boolean

    // 优先检查法律风险
    if (legalResult && !legalResult.isLegal) {
      const legalRiskWeight = legalResult.riskLevel === 'critical' ? 0.95 :
                              legalResult.riskLevel === 'high' ? 0.85 :
                              legalResult.riskLevel === 'medium' ? 0.75 : 0.6

      if (legalRiskWeight >= this.config.confidenceThreshold) {
        category = 'dangerous'
        confidence = legalRiskWeight
        reason = `法律风险: ${legalResult.matchedProvisions[0] || '涉及违法行为'}`
        needsLayer2 = false
        return {
          category,
          confidence,
          reason,
          needsLayer2,
          riskScore: Math.max(riskScore, legalRiskWeight * 100),
          detectedPatterns: [...patterns, `legal: ${legalResult.riskLevel}`],
        }
      }
    }

    // 如果同时有安全词和危险词，转Layer 2深度分析
    if (dangerScore >= 0.5 && safeScore >= 0.5) {
      category = 'suspicious'
      confidence = Math.max(dangerScore, safeScore)
      reason = '检测到安全词和危险词混合，需要深度分析'
      needsLayer2 = true
    } else if (dangerScore >= this.config.confidenceThreshold) {
      // 明确危险
      category = 'dangerous'
      confidence = dangerScore
      reason = '检测到明确的危险模式'
      needsLayer2 = false
    } else if (suspiciousScore >= this.config.confidenceThreshold) {
      // 可疑 - 需要Layer 2
      category = 'suspicious'
      confidence = suspiciousScore
      reason = '检测到可疑模式，需要深度分析'
      needsLayer2 = true
    } else if (safeScore >= 0.5) {
      // 有安全词且无危险/可疑模式 - 放行
      category = 'safe'
      confidence = safeScore
      reason = '检测到安全词，无危险模式'
      needsLayer2 = false
    } else if (dangerScore > 0.3) {
      // 有危险词但置信度不够 - 转Layer 2
      category = 'suspicious'
      confidence = dangerScore
      reason = '检测到危险词，需要深度分析'
      needsLayer2 = true
    } else {
      // 无明显特征 - 放行（不再默认拦截）
      category = 'safe'
      confidence = 0.6
      reason = '无明显危险特征'
      needsLayer2 = false
    }

    return {
      category,
      confidence,
      reason,
      needsLayer2,
      riskScore,
      detectedPatterns: patterns,
    }
  }

  /**
   * 批量分析（用于测试）
   */
  analyzeBatch(messages: string[]): LocalIntentResult[] {
    return messages.map(msg => this.analyze(msg))
  }

  /**
   * 获取统计信息
   */
  getStats(results: LocalIntentResult[]): {
    total: number
    safe: number
    dangerous: number
    suspicious: number
    ambiguous: number
    needsLayer2: number
    layer2Rate: number
  } {
    const stats = {
      total: results.length,
      safe: results.filter(r => r.category === 'safe').length,
      dangerous: results.filter(r => r.category === 'dangerous').length,
      suspicious: results.filter(r => r.category === 'suspicious').length,
      ambiguous: results.filter(r => r.category === 'ambiguous').length,
      needsLayer2: results.filter(r => r.needsLayer2).length,
      layer2Rate: 0,
    }
    stats.layer2Rate = stats.needsLayer2 / stats.total
    return stats
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultAnalyzer: LocalIntentAnalyzer | null = null

export function getLocalIntentAnalyzer(config?: LocalIntentAnalyzerConfig): LocalIntentAnalyzer {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new LocalIntentAnalyzer(config)
  }
  return defaultAnalyzer
}

export function resetLocalIntentAnalyzer(config?: LocalIntentAnalyzerConfig): LocalIntentAnalyzer {
  defaultAnalyzer = new LocalIntentAnalyzer(config)
  return defaultAnalyzer
}
