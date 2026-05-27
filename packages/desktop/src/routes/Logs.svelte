<script lang="ts">
  import { onMount } from 'svelte'
  import { api, loadLogs, logs } from '../stores'

  let level = ''
  let category = ''

  onMount(() => loadLogs())

  function filter() {
    loadLogs(level || undefined, category || undefined)
  }

  function clear() {
    if (!confirm('确认清空所有日志？')) return
    api('/api/logs', { method: 'DELETE' }).then(() => loadLogs())
  }

  const levelColors: Record<string, string> = {
    error: '#ef4444',
    warn: '#f59e0b',
    info: '#22c55e',
    debug: '#8b5cf6',
  }

  let autoRefresh = true
  let timer: any
  onMount(() => {
    timer = setInterval(() => { if (autoRefresh) loadLogs(level || undefined, category || undefined) }, 3000)
    return () => clearInterval(timer)
  })
</script>

<div class="h-full flex flex-col p-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">📋 日志</h1>
    <div class="flex gap-2">
      <button onclick={clear} class="px-3 py-1.5 rounded-lg text-xs font-medium"
        style="background: var(--danger); color: white;">清空</button>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex gap-2 mb-4">
    <select bind:value={level} onchange={filter} class="px-3 py-2 rounded-lg text-sm"
      style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
      <option value="">全部级别</option>
      <option value="error">错误</option>
      <option value="warn">警告</option>
      <option value="info">信息</option>
      <option value="debug">调试</option>
    </select>
    <select bind:value={category} onchange={filter} class="px-3 py-2 rounded-lg text-sm"
      style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);">
      <option value="">全部分类</option>
      <option value="chat">对话</option>
      <option value="session">会话</option>
      <option value="agent">Agent</option>
      <option value="sentinel">Sentinel</option>
      <option value="tool">工具</option>
      <option value="search">搜索</option>
      <option value="settings">设置</option>
      <option value="assistant">助手</option>
    </select>
    <label class="flex items-center gap-1 text-xs" style="color: var(--text-muted);">
      <input type="checkbox" bind:checked={autoRefresh} />
      自动刷新
    </label>
  </div>

  <!-- Log list -->
  <div class="flex-1 overflow-auto rounded-xl" style="border: 1px solid var(--border);">
    <table class="w-full text-sm">
      <thead>
        <tr style="background: var(--bg-secondary);">
          <th class="text-left px-4 py-3 font-medium" style="color: var(--text-muted); width: 90px;">时间</th>
          <th class="text-left px-4 py-3 font-medium" style="color: var(--text-muted); width: 60px;">级别</th>
          <th class="text-left px-4 py-3 font-medium" style="color: var(--text-muted); width: 70px;">分类</th>
          <th class="text-left px-4 py-3 font-medium" style="color: var(--text-muted);">消息</th>
          <th class="text-right px-4 py-3 font-medium" style="color: var(--text-muted); width: 70px;">耗时</th>
        </tr>
      </thead>
      <tbody>
        {#each ($logs.logs || []) as log}
          <tr style="border-top: 1px solid var(--border);">
            <td class="px-4 py-2 text-xs" style="color: var(--text-muted);">{log.timestamp?.slice(11, 19) || '-'}</td>
            <td class="px-4 py-2">
              <span class="text-xs px-1.5 py-0.5 rounded font-medium"
                style="background: {(levelColors[log.level] || '#6b7280')}20; color: {levelColors[log.level] || '#6b7280'};">
                {log.level}
              </span>
            </td>
            <td class="px-4 py-2 text-xs" style="color: var(--text-secondary);">{log.category}</td>
            <td class="px-4 py-2 text-xs" style="color: var(--text-primary); max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{log.message}</td>
            <td class="px-4 py-2 text-right text-xs" style="color: var(--text-muted);">{log.duration ? `${log.duration}ms` : ''}</td>
          </tr>
        {/each}
        {#if !($logs.logs || []).length}
          <tr><td colspan="5" class="px-4 py-8 text-center" style="color: var(--text-muted);">暂无日志</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>