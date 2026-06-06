<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../stores'

  let settings: Record<string, any> = {}
  let agent: any = null
  let workspace: Record<string, string> = {}
  let saved = false
  let sounds: string[] = []
  let activeTab = 'general'

  onMount(async () => {
    try { settings = await api('/api/settings') } catch {}
    try { agent = await api('/api/agents/default-desktop-agent') } catch {}
    try { workspace = await api('/api/agents/default-desktop-agent/workspace') } catch {}
    try { const r = await api('/api/settings/sounds'); sounds = r.sounds || [] } catch {}
  })

  async function saveSettings() {
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) })
      // Save workspace files
      for (const [file, content] of Object.entries(workspace)) {
        await api(`/api/agents/default-desktop-agent/workspace/${file}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        })
      }
      saved = true
      setTimeout(() => saved = false, 2000)
    } catch (e: any) { alert(e.message) }
  }

  const tabs = [
    { id: 'general', label: '通用', icon: '⚙️' },
    { id: 'model', label: '模型', icon: '🧠' },
    { id: 'soul', label: '灵魂', icon: '👻' },
    { id: 'about', label: '关于', icon: 'ℹ️' },
  ]
</script>

<div class="h-full overflow-auto p-6">
  <h1 class="text-xl font-semibold mb-6" style="color: var(--text-primary);">⚙️ 设置</h1>

  <!-- Tabs -->
  <div class="flex gap-1 p-1 rounded-lg mb-6" style="background: var(--bg-secondary);">
    {#each tabs as t}
      <button onclick={() => activeTab = t.id}
        class="flex-1 py-2 text-sm rounded-md font-medium transition-colors flex items-center justify-center gap-1"
        style="background: {activeTab === t.id ? 'var(--accent)' : 'transparent'}; color: {activeTab === t.id ? 'white' : 'var(--text-secondary)'};">
        {t.icon} {t.label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'general'}
    <div class="space-y-4 max-w-lg">
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">语言</label>
        <select bind:value={settings.language} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">主题</label>
        <select bind:value={settings.theme} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
          <option value="dark">暗色</option>
          <option value="light">亮色</option>
          <option value="auto">跟随系统</option>
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">提示音</label>
        <input bind:value={settings.sound} list="sound-list" placeholder="ding" class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
        <datalist id="sound-list">
          {#each sounds as s}
            <option value={s}></option>
          {/each}
        </datalist>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">用户名</label>
        <input bind:value={settings.username} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">角色</label>
        <textarea bind:value={settings.userRole} rows="2" class="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
      </div>
    </div>
  {:else if activeTab === 'model'}
    <div class="space-y-4 max-w-lg">
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">LLM 提供商</label>
        <select bind:value={settings.llmProvider} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">API Key</label>
        <input bind:value={settings.anthropicApiKey} type="password" class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">API Endpoint</label>
        <input bind:value={settings.anthropicApiEndpoint} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">默认模型</label>
        <input bind:value={settings.defaultModel} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
      </div>

      <!-- 安全推理模型 -->
      <div class="pt-2 mt-2" style="border-top: 1px solid var(--border);">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs font-medium" style="color: var(--text-muted);">🛡️ 安全推理模型</span>
          <span class="text-xs" style="color: var(--text-muted); opacity: 0.6;">Sentinel Layer 2/3</span>
        </div>
        <div>
          <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">推理模型来源</label>
          <select bind:value={settings.sentinelLlmProvider} class="w-full px-3 py-2 rounded-lg text-sm"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
            <option value="same">与主模型相同</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        {#if settings.sentinelLlmProvider && settings.sentinelLlmProvider !== 'same'}
          <div class="mt-3 space-y-3 pl-2" style="border-left: 2px solid var(--accent);">
            <div>
              <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">API Key</label>
              <input bind:value={settings.sentinelApiKey} type="password" placeholder="留空则复用主模型 Key" class="w-full px-3 py-2 rounded-lg text-sm"
                style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
            </div>
            <div>
              <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">模型</label>
              <input bind:value={settings.sentinelModel} placeholder={settings.sentinelLlmProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'} class="w-full px-3 py-2 rounded-lg text-sm"
                style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
            </div>
            <div>
              <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">API Endpoint</label>
              <input bind:value={settings.sentinelApiEndpoint} placeholder="留空使用默认" class="w-full px-3 py-2 rounded-lg text-sm"
                style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
            </div>
          </div>
        {/if}
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">搜索引擎</label>
        <select bind:value={settings.searchEngine} class="w-full px-3 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
          <option value="searxng">SearXNG</option>
          <option value="none">关闭</option>
        </select>
      </div>
      {#if settings.searchEngine === 'searxng'}
        <div>
          <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">SearXNG URL</label>
          <input bind:value={settings.searxngUrl} class="w-full px-3 py-2 rounded-lg text-sm"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
        </div>
      {/if}
    </div>
  {:else if activeTab === 'soul'}
    <div class="space-y-4 max-w-2xl">
      <div class="p-3 rounded-lg text-xs" style="background: rgba(59,130,246,0.1); color: #3b82f6;">
        这些 .md 文件定义了 Agent 的灵魂。编辑后自动同步到数据库。
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">SOUL.md — 性格与规则</label>
        <textarea bind:value={workspace['SOUL.md']} rows="10" class="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">IDENTITY.md — 身份</label>
        <textarea bind:value={workspace['IDENTITY.md']} rows="6" class="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">USER.md — 用户画像</label>
        <textarea bind:value={workspace['USER.md']} rows="6" class="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
      </div>
      <div>
        <label class="block text-xs mb-1 font-medium" style="color: var(--text-muted);">TOOLS.md — 工具指南</label>
        <textarea bind:value={workspace['TOOLS.md']} rows="6" class="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
          style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
      </div>
    </div>
  {:else if activeTab === 'about'}
    <div class="space-y-3 max-w-lg">
      <div class="p-4 rounded-xl text-center" style="background: var(--bg-secondary); border: 1px solid var(--border);">
        <div class="text-3xl mb-2">🧠</div>
        <div class="text-lg font-semibold" style="color: var(--text-primary);">ColoMind</div>
        <div class="text-xs mt-1" style="color: var(--text-muted);">本地优先 AI 桌面助手</div>
        <div class="text-xs mt-2" style="color: var(--text-muted);">Tauri + Svelte + @colomind/core</div>
      </div>
    </div>
  {/if}

  <!-- Save button -->
  <div class="mt-6 max-w-lg">
    <button onclick={saveSettings} class="px-6 py-2 rounded-lg text-sm font-medium"
      style="background: var(--accent); color: white;">
      {saved ? '✓ 已保存' : '保存'}
    </button>
  </div>
</div>
