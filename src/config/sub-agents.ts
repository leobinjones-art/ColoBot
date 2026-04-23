/**
 * 子 Agent 配置
 * 优先级：数据库 > 环境变量 > 默认值
 */

export type SubAgentType = 'search' | 'analysis' | 'writing' | 'review' | 'general';

export interface SubAgentConfig {
  personality: string;
  rules: string[];
  skills: string[];
  tools: string[];
}

/**
 * 默认子 Agent 配置
 */
export const DEFAULT_SUB_AGENT_CONFIGS: Record<SubAgentType, SubAgentConfig> = {
  search: {
    personality: '严谨、全面、注重来源',
    rules: [
      '使用 academic_search 或 web_search 工具搜索',
      '优先使用学术搜索引擎',
      '标注文献来源和年份',
      '如果搜索不可用，基于专业知识推荐经典文献',
    ],
    skills: ['文献检索', '信息筛选', '来源验证'],
    tools: ['web_search', 'academic_search', 'search_memory'],
  },
  analysis: {
    personality: '逻辑严密、数据驱动、客观',
    rules: [
      '基于真实数据进行分析',
      '不编造数据或结论',
      '提供推理过程',
      '指出局限性',
    ],
    skills: ['数据分析', '逻辑推理', '批判性思维'],
    tools: ['search_memory', 'read_file', 'web_search'],
  },
  writing: {
    personality: '专业、规范、注重结构',
    rules: [
      '遵循学术写作规范',
      '结构清晰、逻辑连贯',
      '引用来源标注',
      '避免抄袭，原创表达',
    ],
    skills: ['学术写作', '论文结构', '文献引用'],
    tools: ['search_memory', 'read_file', 'write_file'],
  },
  review: {
    personality: '严格、公正、细致',
    rules: [
      '检测幻觉和编造内容',
      '验证逻辑一致性',
      '检查引用来源',
      '提出具体改进建议',
    ],
    skills: ['内容审核', '质量评估', '问题诊断'],
    tools: ['search_memory', 'web_search'],
  },
  general: {
    personality: '专业、严谨、注重细节',
    rules: [
      '基于用户提供的真实数据进行分析',
      '不编造数据或结论',
      '输出结构清晰、逻辑连贯',
    ],
    skills: ['问题处理', '信息整理'],
    tools: ['search_memory', 'web_search', 'read_file', 'write_file'],
  },
};

// 缓存数据库配置
let cachedConfigs: Record<string, SubAgentConfig> | null = null;

/**
 * 从数据库加载子 Agent 配置
 */
export async function loadSubAgentConfigsFromDb(): Promise<Record<string, SubAgentConfig>> {
  if (cachedConfigs) return cachedConfigs;

  try {
    const { query } = await import('../memory/db.js');
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM agent_settings WHERE setting_key LIKE 'sub_agent_config_%'`
    );

    const configs: Record<string, SubAgentConfig> = {};
    for (const row of rows) {
      const type = row.setting_key.replace('sub_agent_config_', '');
      try {
        configs[type] = JSON.parse(row.setting_value) as SubAgentConfig;
      } catch { /* skip invalid */ }
    }

    cachedConfigs = Object.keys(configs).length > 0 ? configs : null;
    return configs;
  } catch (e) {
    console.error('[SubAgent] Failed to load configs from DB:', e);
    return {};
  }
}

/**
 * 保存子 Agent 配置到数据库
 */
export async function saveSubAgentConfigToDb(type: string, config: SubAgentConfig): Promise<void> {
  const { query } = await import('../memory/db.js');
  await query(
    `INSERT INTO agent_settings (setting_key, setting_value, description, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
    [`sub_agent_config_${type}`, JSON.stringify(config), `SubAgent Config: ${type}`]
  );
  cachedConfigs = null; // 清除缓存
}

/**
 * 获取子 Agent 配置
 * 优先级：数据库 > 环境变量 > 默认值
 */
export async function getSubAgentConfigAsync(type: SubAgentType): Promise<SubAgentConfig> {
  // 1. 检查数据库
  const dbConfigs = await loadSubAgentConfigsFromDb();
  if (dbConfigs[type]) {
    return dbConfigs[type];
  }

  // 2. 检查环境变量
  const envKey = `SUB_AGENT_CONFIG_${type.toUpperCase()}`;
  const envConfig = process.env[envKey];
  if (envConfig) {
    try {
      return JSON.parse(envConfig) as SubAgentConfig;
    } catch { /* skip invalid */ }
  }

  // 3. 返回默认值
  return DEFAULT_SUB_AGENT_CONFIGS[type];
}

/**
 * 获取子 Agent 配置（同步版本，用于向后兼容）
 */
export function getSubAgentConfig(type: SubAgentType): SubAgentConfig {
  const envKey = `SUB_AGENT_CONFIG_${type.toUpperCase()}`;
  const envConfig = process.env[envKey];
  if (envConfig) {
    try {
      return JSON.parse(envConfig) as SubAgentConfig;
    } catch { /* skip invalid */ }
  }
  return DEFAULT_SUB_AGENT_CONFIGS[type];
}

/**
 * 获取所有子 Agent 配置（包含来源信息）
 */
export async function getAllSubAgentConfigsAsync(): Promise<Record<string, { config: SubAgentConfig; source: 'db' | 'env' | 'default' }>> {
  const result: Record<string, { config: SubAgentConfig; source: 'db' | 'env' | 'default' }> = {};

  const dbConfigs = await loadSubAgentConfigsFromDb();

  for (const type of Object.keys(DEFAULT_SUB_AGENT_CONFIGS) as SubAgentType[]) {
    const envKey = `SUB_AGENT_CONFIG_${type.toUpperCase()}`;
    const envConfig = process.env[envKey];

    if (dbConfigs[type]) {
      result[type] = { config: dbConfigs[type], source: 'db' };
    } else if (envConfig) {
      try {
        result[type] = { config: JSON.parse(envConfig), source: 'env' };
      } catch {
        result[type] = { config: DEFAULT_SUB_AGENT_CONFIGS[type], source: 'default' };
      }
    } else {
      result[type] = { config: DEFAULT_SUB_AGENT_CONFIGS[type], source: 'default' };
    }
  }

  return result;
}

/**
 * 获取所有子 Agent 配置（同步版本）
 */
export function getAllSubAgentConfigs(): Record<SubAgentType, SubAgentConfig> {
  const types: SubAgentType[] = ['search', 'analysis', 'writing', 'review', 'general'];
  const configs: Partial<Record<SubAgentType, SubAgentConfig>> = {};

  for (const type of types) {
    configs[type] = getSubAgentConfig(type);
  }

  return configs as Record<SubAgentType, SubAgentConfig>;
}
