<script lang="ts">
  import { onMount } from 'svelte'
  import { api, assistantData } from '../stores'

  export let endpoint: string
  export let title: string
  export let icon: string
  export let columns: { key: string; label: string; type?: 'text' | 'date' | 'number' | 'boolean' }[]
  export let formFields: { key: string; label: string; type?: 'text' | 'date' | 'number' | 'textarea' }[]

  let items: any[] = []
  let showForm = false
  let form: Record<string, any> = {}
  let editingId: string | null = null

  onMount(async () => {
    await load()
  })

  async function load() {
    try {
      items = await api(`/api/assistant/${endpoint}`)
      $assistantData = { ...$assistantData, [endpoint]: items }
    } catch { /* */ }
  }

  async function save() {
    try {
      if (editingId) {
        await api(`/api/assistant/${endpoint}/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        await api(`/api/assistant/${endpoint}`, { method: 'POST', body: JSON.stringify(form) })
      }
      showForm = false
      form = {}
      editingId = null
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除？')) return
    await api(`/api/assistant/${endpoint}/${id}`, { method: 'DELETE' })
    await load()
  }

  function edit(item: any) {
    form = { ...item }
    editingId = item.id
    showForm = true
  }

  function add() {
    form = {}
    editingId = null
    showForm = true
  }

  function formatVal(val: any, type?: string) {
    if (val == null) return '-'
    if (type === 'date') return new Date(val).toLocaleDateString('zh-CN')
    if (type === 'boolean') return val ? '✅' : '❌'
    return String(val).slice(0, 60)
  }
</script>

<div class="h-full flex flex-col p-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">
      {icon} {title}
    </h1>
    <button onclick={add} class="px-4 py-2 rounded-lg text-sm font-medium"
      style="background: var(--accent); color: white;">+ 新增</button>
  </div>

  {#if showForm}
    <div class="mb-4 p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
      <div class="grid grid-cols-2 gap-3">
        {#each formFields as f}
          <div>
            <label class="block text-xs mb-1" style="color: var(--text-muted);">{f.label}</label>
            {#if f.type === 'textarea'}
              <textarea bind:value={form[f.key]} class="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"
                rows="3"></textarea>
            {:else}
              <input bind:value={form[f.key]} type={f.type || 'text'}
                class="w-full px-3 py-2 rounded-lg text-sm"
                style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
            {/if}
          </div>
        {/each}
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

  <div class="flex-1 overflow-auto rounded-xl" style="border: 1px solid var(--border);">
    <table class="w-full text-sm">
      <thead>
        <tr style="background: var(--bg-secondary);">
          {#each columns as c}
            <th class="text-left px-4 py-3 font-medium" style="color: var(--text-muted);">{c.label}</th>
          {/each}
          <th class="text-right px-4 py-3 font-medium" style="color: var(--text-muted);">操作</th>
        </tr>
      </thead>
      <tbody>
        {#each items as item}
          <tr style="border-top: 1px solid var(--border);">
            {#each columns as c}
              <td class="px-4 py-3" style="color: var(--text-primary);">
                {formatVal(item[c.key], c.type)}
              </td>
            {/each}
            <td class="px-4 py-3 text-right">
              <button onclick={() => edit(item)} class="text-xs px-2 py-1 rounded"
                style="color: var(--accent);">编辑</button>
              <button onclick={() => remove(item.id)} class="text-xs px-2 py-1 rounded"
                style="color: var(--danger);">删除</button>
            </td>
          </tr>
        {/each}
        {#if items.length === 0}
          <tr><td colspan={columns.length + 1} class="px-4 py-8 text-center"
            style="color: var(--text-muted);">暂无数据</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>