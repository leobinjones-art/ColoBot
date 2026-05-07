/**
 * Markdown 渲染 Composable
 */
import { Marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

const LANG_DISPLAY: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  sh: 'Shell',
  bash: 'Bash',
  shell: 'Shell',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  html: 'HTML',
  css: 'CSS',
  md: 'Markdown',
  markdown: 'Markdown',
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const customRenderer = {
  code({ text, lang }: { text: string; lang?: string }): string {
    const rawCode = text || ''
    const infoStr = (lang || '').split(/\s/)[0]
    const detectedLang = infoStr.toLowerCase()

    let highlighted: string
    try {
      if (detectedLang && hljs.getLanguage(detectedLang)) {
        highlighted = hljs.highlight(rawCode, { language: detectedLang }).value
      } else {
        highlighted = hljs.highlightAuto(rawCode).value
      }
    } catch {
      highlighted = escapeHtml(rawCode)
    }

    const langLabel = LANG_DISPLAY[detectedLang] || detectedLang || 'Code'
    const lineCount = rawCode.split('\n').length

    return `<div class="code-block">
      <div class="code-block__header">
        <span class="code-block__lang">${escapeHtml(langLabel)}</span>
        <span class="code-block__lines">${lineCount} lines</span>
      </div>
      <pre><code class="hljs">${highlighted}</code></pre>
    </div>`
  },

  link({ href, text }: { href?: string; text?: string }): string {
    if (!href || !/^https?:|^\/|^#/.test(href)) {
      return text || ''
    }
    const safeHref = escapeHtml(href)
    const safeText = escapeHtml(text || href)
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`
  },
}

const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: customRenderer,
})

const purifyConfig = {
  ADD_ATTR: ['target', 'rel', 'class'],
  ADD_TAGS: ['span', 'div', 'pre', 'code'],
}

const RENDER_CACHE = new Map<string, string>()
const RENDER_CACHE_CAP = 200

function cacheKey(text: string): string {
  return `${text.length}:${text.slice(0, 40)}:${text.slice(-40)}`
}

export function useMarkdownRenderer() {
  function renderMarkdown(content: string): string {
    if (!content) return ''

    const k = cacheKey(content)
    const cached = RENDER_CACHE.get(k)
    if (cached !== undefined) {
      RENDER_CACHE.delete(k)
      RENDER_CACHE.set(k, cached)
      return cached
    }

    const rawHtml = markedInstance.parse(content) as string
    const result = DOMPurify.sanitize(rawHtml, purifyConfig)

    if (RENDER_CACHE.size >= RENDER_CACHE_CAP) {
      const oldestKey = RENDER_CACHE.keys().next().value
      if (oldestKey !== undefined) RENDER_CACHE.delete(oldestKey)
    }
    RENDER_CACHE.set(k, result)

    return result
  }

  return { renderMarkdown }
}

export { markedInstance }
