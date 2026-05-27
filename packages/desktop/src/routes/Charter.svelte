<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../stores'

  let charters: any[] = []
  let libraries: any[] = []
  let tab = 'charters'

  onMount(async () => {
    try { charters = await api('/api/charters') } catch {}
    try { libraries = await api('/api/libraries') } catch {}
  })

  async function removeCharter(id: string) {
    if (!confirm('确认删除？')) return
    await api(`/api/charters/${id}`, { method: 'DELETE' })
    charters = charters.filter(c => c.id !== id)
  }

  async function removeLibrary(id: string) {
    if (!confirm('确认删除？')) return
    await api(`/api/libraries/${id}`, { method: 'DELETE' })
    libraries = libraries.filter(l => l.id !== id)
  }

  const typeLabels: Record<string, string> = {
    academic: '学术', medical: '医疗', legal: '法律', finance: '金融', custom: '自定义',
  }
</script>

<div class="h-full overflow-auto p-6 space-y-6">
  <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">📜 Charter 许可证</h1>

  <!-- Tabs -->
  <div class="flex gap-1 p-1 rounded-lg" style="background: var(--bg-secondary);">
    <button onclick={() => tab = 'charters'}
      class="flex-1 py-2 text-sm rounded-md font-medium transition-colors"
      style="background: {tab === 'charters' ? 'var(--accent)' : 'transparent'}; color: {tab === 'charters' ? 'white' : 'var(--text-secondary)'};">
      许可证
    </button>
    <button onclick={() => tab = 'libraries'}
      class="flex-1 py-2 text-sm rounded-md font-medium transition-colors"
      style="background: {tab === 'libraries' ? 'var(--accent)' : 'transparent'}; color: {tab === 'libraries' ? 'white' : 'var(--text-secondary)'};">
      文档库
    </button>
  </div>

  {#if tab === 'charters'}
    <div class="space-y-3">
      {#each charters as charter}
        <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-sm" style="color: var(--text-primary);">{charter.name}</div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded" style="background: var(--bg-tertiary); color: var(--text-secondary);">
                  {typeLabels[charter.type] || charter.type}
                </span>
                {#if charter.description}
                  <span class="text-xs" style="color: var(--text-muted);">{charter.description}</span>
                {/if}
              </div>
            </div>
            <button onclick={() => removeCharter(charter.id)} class="text-xs" style="color: var(--danger);">删除</button>
          </div>
          {#if charter.capabilities?.length}
            <div class="mt-2 flex flex-wrap gap-1">
              {#each charter.capabilities as cap}
                <span class="text-xs px-2 py-0.5 rounded" style="background: rgba(59,130,246,0.1); color: #3b82f6;">{cap}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      {#if charters.length === 0}
        <div class="py-12 text-center" style="color: var(--text-muted);">暂无许可证</div>
      {/if}
    </div>
  {:else}
    <div class="space-y-3">
      {#each libraries as lib}
        <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-sm" style="color: var(--text-primary);">{lib.name}</div>
              <div class="text-xs mt-1" style="color: var(--text-muted);">{lib.description || ''}</div>
            </div>
            <button onclick={() => removeLibrary(lib.id)} class="text-xs" style="color: var(--danger);">删除</button>
          </div>
        </div>
      {/each}
      {#if libraries.length === 0}
        <div class="py-12 text-center" style="color: var(--text-muted);">暂无文档库</div>
      {/if}
    </div>
  {/if}
</div>
