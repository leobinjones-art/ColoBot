/**
 * 微信公众号文章读取 Skill
 *
 * 功能：
 * - 通过 URL 获取公众号文章
 * - 提取标题、作者、正文内容
 * - 生成 AI 总结
 */

import { execSync } from 'child_process';

export interface WechatArticle {
  url: string;
  title: string;
  author: string;
  publishTime?: string;
  content: string;
  summary?: string;
  keyPoints?: string[];
}

export interface WechatArticleOptions {
  summarize?: boolean;      // 是否生成 AI 总结
  extractKeyPoints?: boolean; // 是否提取关键点
  maxContentLength?: number; // 最大内容长度
}

/**
 * 获取公众号文章
 */
export async function fetchWechatArticle(
  url: string,
  options: WechatArticleOptions = {}
): Promise<WechatArticle> {
  const { maxContentLength = 10000 } = options;

  // 使用 curl 获取 HTML
  const html = fetchHtml(url);

  // 解析内容
  const title = extractTitle(html);
  const author = extractAuthor(html);
  const content = extractContent(html, maxContentLength);

  return {
    url,
    title,
    author,
    content,
  };
}

/**
 * 获取文章并生成总结
 */
export async function fetchAndSummarizeWechatArticle(
  url: string,
  llmChat: (prompt: string) => Promise<string>,
  options: WechatArticleOptions = {}
): Promise<WechatArticle> {
  const article = await fetchWechatArticle(url, options);

  if (options.summarize !== false) {
    const summaryResult = await generateSummary(article.content, llmChat);
    article.summary = summaryResult.summary;
    article.keyPoints = summaryResult.keyPoints;
  }

  return article;
}

// ── 内部实现 ──────────────────────────────────────────────

function fetchHtml(url: string): string {
  try {
    const result = execSync(
      `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`,
      { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    return result;
  } catch (e) {
    throw new Error(`Failed to fetch article: ${(e as Error).message}`);
  }
}

function extractTitle(html: string): string {
  // 方法1: og:title meta
  const ogMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
  if (ogMatch) {
    return decodeHtmlEntities(ogMatch[1]);
  }

  // 方法2: activity-name
  const activityMatch = html.match(/id="activity-name"[^>]*>([\s\S]*?)<\/h1>/);
  if (activityMatch) {
    return cleanHtmlTags(activityMatch[1]).trim();
  }

  return '未知标题';
}

function extractAuthor(html: string): string {
  // js_name 元素
  const match = html.match(/id="js_name"[^>]*>([\s\S]*?)<\/a>/);
  if (match) {
    return cleanHtmlTags(match[1]).trim();
  }

  return '未知作者';
}

function extractContent(html: string, maxLength: number): string {
  // 提取 js_content 区域
  const contentMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);

  if (!contentMatch) {
    // 备用：尝试提取 rich_media_content
    const richMatch = html.match(/class="rich_media_content"[^>]*>([\s\S]*?)<\/div>/);
    if (richMatch) {
      return cleanContent(richMatch[1], maxLength);
    }
    return '';
  }

  return cleanContent(contentMatch[1], maxLength);
}

function cleanContent(html: string, maxLength: number): string {
  let text = html;

  // 移除图片标签，保留 alt
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[图片: $1]');
  text = text.replace(/<img[^>]*>/gi, '[图片]');

  // 移除其他标签
  text = cleanHtmlTags(text);

  // 解码 HTML 实体
  text = decodeHtmlEntities(text);

  // 清理空白
  text = text.replace(/\s+/g, ' ').trim();

  // 截断
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }

  return text;
}

function cleanHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function generateSummary(
  content: string,
  llmChat: (prompt: string) => Promise<string>
): Promise<{ summary: string; keyPoints: string[] }> {
  const prompt = `请分析以下文章内容，生成总结和关键要点。

文章内容：
${content.slice(0, 3000)}

请以 JSON 格式返回：
{
  "summary": "文章总结（100-200字）",
  "keyPoints": ["要点1", "要点2", "要点3", "要点4", "要点5"]
}

只返回 JSON，不要其他内容。`;

  try {
    const response = await llmChat(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
      };
    }
  } catch (e) {
    console.error('[WechatArticle] Failed to generate summary:', (e as Error).message);
  }

  return { summary: '', keyPoints: [] };
}

// ── 工具注册 ──────────────────────────────────────────────

/**
 * 注册为工具
 */
export function registerWechatArticleTool(
  toolRegistry: { register: (tool: any) => void },
  llmChat?: (prompt: string) => Promise<string>
): void {
  toolRegistry.register({
    name: 'read_wechat_article',
    description: '读取微信公众号文章并提取内容，支持 AI 总结',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '微信公众号文章链接 (mp.weixin.qq.com/s/...)',
        },
        summarize: {
          type: 'boolean',
          description: '是否生成 AI 总结（默认 true）',
        },
      },
      required: ['url'],
    },
    execute: async (args: Record<string, unknown>) => {
      const url = args.url as string;
      const summarize = args.summarize !== false;

      if (!url.includes('mp.weixin.qq.com')) {
        return '错误：请提供有效的微信公众号文章链接';
      }

      try {
        if (summarize && llmChat) {
          const article = await fetchAndSummarizeWechatArticle(url, llmChat);
          return formatArticleResult(article);
        } else {
          const article = await fetchWechatArticle(url);
          return formatArticleResult(article);
        }
      } catch (e) {
        return `错误：${(e as Error).message}`;
      }
    },
  });
}

function formatArticleResult(article: WechatArticle): string {
  const lines = [
    `# ${article.title}`,
    '',
    `**作者**: ${article.author}`,
    `**链接**: ${article.url}`,
    '',
    '---',
    '',
    '## 正文内容',
    '',
    article.content,
  ];

  if (article.summary) {
    lines.push('', '---', '', '## AI 总结', '', article.summary);
  }

  if (article.keyPoints?.length) {
    lines.push('', '## 关键要点', '');
    article.keyPoints.forEach((point, i) => {
      lines.push(`${i + 1}. ${point}`);
    });
  }

  return lines.join('\n');
}
