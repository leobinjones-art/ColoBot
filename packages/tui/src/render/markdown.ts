/**
 * Markdown 渲染器 - 终端 Markdown 渲染
 */

import { marked } from 'marked'
import hljs from 'highlight.js'
import { colors, style } from './index.js'

/**
 * 渲染 Markdown 为终端输出
 */
export function renderMarkdown(text: string): string {
  const tokens = marked.lexer(text)
  return tokens.map(renderToken).join('')
}

/**
 * 渲染单个 token
 */
function renderToken(token: any, depth = 0): string {
  switch (token.type) {
    case 'heading':
      return renderHeading(token)

    case 'paragraph':
      return renderParagraph(token)

    case 'code':
      return renderCode(token)

    case 'codespan':
      return renderInlineCode(token)

    case 'list':
      return renderList(token)

    case 'list_item':
      return renderListItem(token)

    case 'blockquote':
      return renderBlockquote(token)

    case 'strong':
      return style(extractText(token), 'bold')

    case 'em':
      return style(extractText(token), 'cyan')

    case 'link':
      return style(token.text || token.href, 'blue')

    case 'image':
      return style(`[图片: ${token.text || token.href}]`, 'dim')

    case 'hr':
      return `\n${colors.dim}${'─'.repeat(60)}${colors.reset}\n`

    case 'br':
      return '\n'

    case 'text':
      return token.text

    default:
      if (token.tokens) {
        return token.tokens.map((t: any) => renderToken(t, depth)).join('')
      }
      return token.text || ''
  }
}

/**
 * 渲染标题
 */
function renderHeading(token: any): string {
  const text = extractText(token)
  const level = token.depth || 1

  const styles: Record<number, string[]> = {
    1: ['bold', 'cyan'],
    2: ['bold', 'green'],
    3: ['bold', 'yellow'],
    4: ['bold', 'blue'],
    5: ['bold', 'magenta'],
    6: ['bold', 'white'],
  }

  const s = styles[level] || ['bold']
  let result = '\n'

  if (level === 1) {
    result += `${colors.cyan}${'═'.repeat(text.length + 4)}${colors.reset}\n`
    result += `${style(text, ...s)}\n`
    result += `${colors.cyan}${'═'.repeat(text.length + 4)}${colors.reset}\n`
  } else if (level === 2) {
    result += `${style('■ ' + text, ...s)}\n`
  } else {
    result += `${style('▶ ' + text, ...s)}\n`
  }

  return result
}

/**
 * 渲染段落
 */
function renderParagraph(token: any): string {
  const text = token.tokens
    ? token.tokens.map((t: any) => renderToken(t)).join('')
    : token.text || ''
  return `\n${text}\n`
}

/**
 * 渲染代码块
 */
function renderCode(token: any): string {
  const lang = token.lang || ''
  const code = token.text || ''

  let result = '\n'

  // 语言标签
  if (lang) {
    result += `${colors.dim}┌─ ${lang}${colors.reset}\n`
  } else {
    result += `${colors.dim}┌─${colors.reset}\n`
  }

  // 代码行
  const lines = code.split('\n')
  for (const line of lines) {
    const highlighted = highlightLine(line, lang)
    result += `${colors.dim}│${colors.reset} ${highlighted}\n`
  }

  result += `${colors.dim}└─${colors.reset}\n`

  return result
}

/**
 * 高亮单行代码
 */
function highlightLine(line: string, lang?: string): string {
  if (!lang || !hljs.getLanguage(lang)) {
    return line
  }

  try {
    const result = hljs.highlight(line, { language: lang, ignoreIllegals: true })
    // 移除所有 HTML 标签，解码 HTML 实体
    return result.value
      .replace(/<[^>]*>/g, '')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  } catch {
    return line
  }
}

/**
 * 渲染行内代码
 */
function renderInlineCode(token: any): string {
  const code = token.text || ''
  return `${colors.bgRed}${colors.white} ${code} ${colors.reset}`
}

/**
 * 渲染列表
 */
function renderList(token: any): string {
  const items = token.items || []
  let result = '\n'

  items.forEach((item: any, index: number) => {
    const prefix = token.ordered ? `${index + 1}. ` : '• '
    const text = item.tokens
      ? item.tokens.map((t: any) => renderToken(t)).join('')
      : item.text || ''
    result += `${style(prefix, 'cyan')}${text}\n`
  })

  return result
}

/**
 * 渲染列表项
 */
function renderListItem(token: any): string {
  const text = token.tokens
    ? token.tokens.map((t: any) => renderToken(t)).join('')
    : token.text || ''
  return text
}

/**
 * 渲染引用块
 */
function renderBlockquote(token: any): string {
  const text = token.tokens
    ? token.tokens.map((t: any) => renderToken(t)).join('')
    : token.text || ''

  const lines = text.split('\n')
  let result = '\n'

  for (const line of lines) {
    result += `${colors.dim}│${colors.reset} ${style(line, 'dim')}\n`
  }

  return result
}

/**
 * 提取文本内容
 */
function extractText(token: any): string {
  if (token.text) return token.text
  if (token.tokens) {
    return token.tokens.map((t: any) => extractText(t)).join('')
  }
  return ''
}

/**
 * 打印 Markdown 消息
 */
export function printMarkdown(text: string): void {
  const rendered = renderMarkdown(text)
  console.log(rendered)
}
