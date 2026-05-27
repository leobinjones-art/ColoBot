<script lang="ts">
  import { onMount } from 'svelte'
  import { sessions, currentSessionId, messages, api } from '../stores'
  import { marked } from 'marked'
  import hljs from 'highlight.js'

  let input = ''
  let streaming = false
  let thinking = ''
  let showThinking = false
  let chatEl: HTMLDivElement

  marked.setOptions({
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value
      return hljs.highlightAuto(code).value
    },
  })

  onMount(async () => {
    try { $sessions = await api('/api/sessions') } catch {}
  })

  async function send() {
    if (!input.trim() || streaming) return
    const msg = input.trim()
    input = ''
    $messages = [...$messages, { role: 'user', content: msg }]
    streaming = true
    thinking = ''
    showThinking = true
    $messages = [...$messages, { role: 'assistant', content: '', thinking: '' }]
    const idx = $messages.length - 1
    try {
      const port = parseInt(localStorage.getItem('sidecar_port') || '3456')
      const res = await fetch(`http://localhost:${port}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: $currentSessionId || 'default',
          messages: $messages.filter(m => m.role !== 'assistant' || m.content),
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const event = JSON.parse(data)
            if (event.error) {
              $messages[idx] = { ...$messages[idx], content: `错误: ${event.error}` }
            } else if (event.type === 'thinking' && event.thinking) {
              thinking += event.thinking
              $messages[idx] = { ...$messages[idx], thinking }
            } else if (event.choices?.[0]?.delta?.content) {
              const chunk = event.choices[0].delta.content
              $messages[idx] = { ...$messages[idx], content: $messages[idx].content + chunk }
            }
            $messages = $messages
            if (chatEl) chatEl.scrollTop = chatEl.scrollHeight
          } catch {}
        }
      }
    } catch (e: any) {
      $messages[idx] = { ...$messages[idx], content: `错误: ${e.message}` }
    }
    streaming = false
    showThinking = false
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function newSession() {
    $currentSessionId = `session-${Date.now()}`
    $messages = []
  }

  function renderMarkdown(text: string): string {
    if (!text) return ''
    try { return marked.parse(text) as string } catch { return text }
  }

  function toggleThinking(m: any) {
    m._showThinking = !m._showThinking
    $messages = $messages
  }
</script>

<div class="flex h-full">
  <!-- Session sidebar -->
  <div class="w-56 flex flex-col" style="background: var(--bg-secondary); border-right: 1px solid var(--border);">
    <div class="p-3">
      <button onclick={newSession} class="w-full py-2 rounded-lg text-sm font-medium"
        style="background: var(--accent); color: white;">+ 新对话</button>
    </div>
    <div class="flex-1 overflow-y-auto px-2">
      {#each $sessions as s}
        <button class="w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors"
          style="background: {$currentSessionId === s.id ? 'var(--bg-tertiary)' : 'transparent'}; color: var(--text-secondary);">
          {s.title || s.id}
        </button>
      {/each}
    </div>
  </div>

  <!-- Chat area -->
  <div class="flex-1 flex flex-col">
    <div bind:this={chatEl} class="flex-1 overflow-y-auto p-6 space-y-4">
      {#each $messages as m}
        <div class="flex gap-3 {m.role === 'user' ? 'justify-end' : ''}">
          {#if m.role === 'assistant'}
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style="background: var(--accent); color: white;">N</div>
          {/if}
          <div class="max-w-[75%] space-y-2">
            <!-- Thinking block -->
            {#if m.thinking}
              <div class="rounded-xl px-4 py-3 text-sm cursor-pointer"
                style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2);"
                onclick={() => toggleThinking(m)}>
                <div class="flex items-center gap-2" style="color: #3b82f6;">
                  <span>💭</span>
                  <span class="font-medium">思考</span>
                  <span class="text-xs opacity-60">{m._showThinking ? '▼' : '▶'}</span>
                </div>
                {#if m._showThinking}
                  <pre class="mt-2 text-xs whitespace-pre-wrap opacity-80" style="color: var(--text-secondary);">{m.thinking}</pre>
                {/if}
              </div>
            {/if}
            <!-- Message content -->
            <div class="rounded-xl px-4 py-3 text-sm leading-relaxed"
              style="background: {m.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {m.role === 'user' ? 'white' : 'var(--text-primary)'};">
              {#if m.role === 'assistant'}
                {@html renderMarkdown(m.content)}
              {:else}
                {m.content}
              {/if}
            </div>
          </div>
          {#if m.role === 'user'}
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style="background: var(--success); color: white;">U</div>
          {/if}
        </div>
      {/each}
      {#if $messages.length === 0}
        <div class="flex-1 flex items-center justify-center" style="color: var(--text-muted);">
          <div class="text-center">
            <div class="text-4xl mb-3">🤖</div>
            <div class="text-lg font-medium">ColoMind</div>
            <div class="text-sm mt-1">开始一段新对话</div>
          </div>
        </div>
      {/if}
    </div>

    <div class="p-4" style="border-top: 1px solid var(--border);">
      <div class="flex gap-2 items-end max-w-4xl mx-auto">
        <textarea bind:value={input} onkeydown={handleKey} placeholder="输入消息..."
          rows="1" class="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"
          oninput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}></textarea>
        <button onclick={send} disabled={streaming || !input.trim()}
          class="px-4 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          style="background: var(--accent); color: white;">
          {streaming ? '...' : '发送'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(.chat-content pre) {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    font-size: 13px;
    margin: 8px 0;
  }
  :global(.chat-content code) {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 13px;
  }
  :global(.chat-content p) { margin: 4px 0; }
  :global(.chat-content ul, .chat-content ol) { padding-left: 20px; margin: 4px 0; }
</style>
