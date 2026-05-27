<script lang="ts">
  import { onMount } from 'svelte'
  import { api, agents } from '../stores'

  let showForm = false
  let form: Record<string, any> = {}
  let editingId: string | null = null

  onMount(load)

  async function load() {
    try { $agents = await api('/api/agents') } catch {}
  }

  async function save() {
    try {
      if (editingId) {
        await api(`/api/agents/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        await api('/api/agents', { method: 'POST', body: JSON.stringify(form) })
      }
      showForm = false; form = {}; editingId = null
      await load()
    } catch (e: any) { alert(e.message) }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await api(`/api/agents/${id}/${active ? 'stop' : 'start'}`, { method: 'POST' })
      await load()
    } catch (e: any) { alert(e.message) }
  }

  async function remove(id: string) {
    if (!confirm('确认删除？')) return
    await api(`/api/agents/${id}`, { method: 'DELETE' })
    await load()
  }

  function edit(item: any) { form = { ...item }; editingId = item.id; showForm = true }
  function add() { form = {}; editingId = null; showForm = true }

  function parseSoul(soulContent: string): any {
    try { return JSON.parse(soulContent || '{}') } catch { return {} }
  }
</script>

<div class="h-full flex flex-col p-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">🤖 Agent</h1>
    <button onclick={add} class="px-4 py-2 rounded-lg text-sm font-medium"
      style="background: var(--accent); color: white;">+ 新增</button>
  </div>

  {#if showForm}
    <div class="mb-4 p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs mb-1" style="color: var(--text-muted);">名称</label>
          <input bind:value={form.name} class="w-full px-3 py-2 rounded-lg text-sm"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
        </div>
        <div>
          <label class="block text-xs mb-1" style="color: var(--text-muted);">模型</label>
          <input bind:value={form.primary_model_id} placeholder="claude-sonnet-4-6" class="w-full px-3 py-2 rounded-lg text-sm"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
        </div>
        <div class="col-span-2">
          <label class="block text-xs mb-1" style="color: var(--text-muted);">Soul (JSON)</label>
          <textarea bind:value={form.soul_content} rows="4" class="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"></textarea>
        </div>
        <div>
          <label class="block text-xs mb-1" style="color: var(--text-muted);">温度</label>
          <input bind:value={form.temperature} type="number" step="0.1" min="0" max="2" class="w-full px-3 py-2 rounded-lg text-sm"
            style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button onclick={save} class="px-4 py-2 rounded-lg text-sm font-medium"
          style="background: var(--accent); color: white;">保存</button>
        <button onclick={() => { showForm = false; form = {}; editingId = null }}
          class="px-4 py-2 rounded-lg text-sm"
          style="background: var(--bg-tertiary); color: var(--text-secondary);">取消</button>
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-auto">
    {#each $agents as agent}
      {@const soul = parseSoul(agent.soul_content)}
      <div class="mb-3 p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full" style="background: {agent.status === 'active' ? 'var(--success)' : 'var(--text-muted)'};"></div>
            <div>
              <div class="font-medium text-sm" style="color: var(--text-primary);">{agent.name}</div>
              <div class="text-xs" style="color: var(--text-muted);">{agent.primary_model_id || '默认模型'}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick={() => toggle(agent.id, agent.status === 'active')}
              class="text-xs px-3 py-1 rounded-lg font-medium"
              style="background: {agent.status === 'active' ? 'var(--danger)' : 'var(--success)'}; color: white;">
              {agent.status === 'active' ? '停止' : '启动'}
            </button>
            <button onclick={() => edit(agent)} class="text-xs px-2 py-1 rounded"
              style="color: var(--accent);">编辑</button>
            <button onclick={() => remove(agent.id)} class="text-xs px-2 py-1 rounded"
              style="color: var(--danger);">删除</button>
          </div>
        </div>
        {#if soul.role || soul.personality}
          <div class="mt-2 text-xs leading-relaxed" style="color: var(--text-secondary);">
            {soul.role || ''} {soul.personality ? `— ${soul.personality}` : ''}
          </div>
        {/if}
      </div>
    {/each}
    {#if $agents.length === 0}
      <div class="py-12 text-center" style="color: var(--text-muted);">暂无 Agent</div>
    {/if}
  </div>
</div>
