<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../stores'

  let skills: any[] = []
  let search = ''

  onMount(async () => {
    try { skills = await api('/api/skills') } catch { /* */ }
  })

  $: filtered = skills.filter(s =>
    !search.trim() || s.name?.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())
  )
</script>

<div class="h-full flex flex-col p-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">⚡ 技能</h1>
    <input bind:value={search} placeholder="搜索技能..." class="px-3 py-2 rounded-lg text-sm w-48"
      style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);" />
  </div>

  <div class="flex-1 overflow-auto">
    {#each filtered as skill}
      <div class="mb-3 p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
        <div class="flex items-center justify-between">
          <div class="font-medium text-sm" style="color: var(--text-primary);">{skill.name}</div>
          {#if skill.enabled != null}
            <span class="text-xs px-2 py-0.5 rounded-full"
              style="background: {skill.enabled ? 'var(--success)' : 'var(--bg-tertiary)'}; color: {skill.enabled ? 'white' : 'var(--text-muted)'};">
              {skill.enabled ? '已启用' : '未启用'}
            </span>
          {/if}
        </div>
        {#if skill.description}
          <div class="mt-1 text-xs" style="color: var(--text-secondary);">{skill.description}</div>
        {/if}
        {#if skill.tools?.length}
          <div class="mt-2 flex flex-wrap gap-1">
            {#each skill.tools as tool}
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: var(--bg-tertiary); color: var(--text-muted);">{tool}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    {#if filtered.length === 0}
      <div class="py-12 text-center" style="color: var(--text-muted);">
        {skills.length === 0 ? '暂无技能' : '无匹配结果'}
      </div>
    {/if}
  </div>
</div>
