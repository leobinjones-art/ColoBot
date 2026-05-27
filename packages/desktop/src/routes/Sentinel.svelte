<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../stores'

  let status: any = null
  let scanResult: any = null
  let scanInput = ''
  let scanning = false
  let scanHistory: any[] = []
  let refreshTimer: any

  onMount(async () => {
    await loadStatus()
    refreshTimer = setInterval(loadStatus, 5000)
  })
  onDestroy(() => clearInterval(refreshTimer))

  async function loadStatus() {
    try { status = await api('/api/sentinel/status') } catch {}
  }

  async function scan() {
    if (!scanInput.trim() || scanning) return
    scanning = true
    try {
      scanResult = await api('/api/sentinel/scan', {
        method: 'POST',
        body: JSON.stringify({ input: scanInput }),
      })
      scanHistory = [{ input: scanInput, ...scanResult, time: new Date() }, ...scanHistory].slice(0, 50)
    } catch (e: any) {
      scanResult = { error: e.message }
    }
    scanning = false
  }

  const layerLabels: Record<string, string> = {
    lexical: '词汇层',
    intent: '意图层',
    legal: '法律层',
  }
  const layerColors: Record<string, string> = {
    lexical: '#ef4444',
    intent: '#f59e0b',
    legal: '#8b5cf6',
  }
</script>

<div class="h-full overflow-auto p-6 space-y-6">
  <h1 class="text-xl font-semibold flex items-center gap-2" style="color: var(--text-primary);">🛡️ Sentinel 安全监控</h1>

  <!-- Status panel -->
  <div class="grid grid-cols-3 gap-4">
    {#each ['lexical', 'intent', 'legal'] as layer}
      <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-3 h-3 rounded-full" style="background: {layerColors[layer]};"></div>
          <span class="font-medium text-sm" style="color: var(--text-primary);">{layerLabels[layer]}</span>
        </div>
        <div class="text-xs" style="color: var(--text-muted);">
          {#if status?.layers?.[layer]}
            阻断词: {status.layers[layer].blockedCount || 0} | 扫描: {status.layers[layer].scanCount || 0}
          {:else}
            等待数据...
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Scan input -->
  <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
    <h2 class="font-medium text-sm mb-3" style="color: var(--text-primary);">安全扫描</h2>
    <div class="flex gap-2">
      <input bind:value={scanInput} placeholder="输入待扫描文本..." class="flex-1 px-3 py-2 rounded-lg text-sm"
        style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border);"
        onkeydown={(e) => e.key === 'Enter' && scan()} />
      <button onclick={scan} disabled={scanning} class="px-4 py-2 rounded-lg text-sm font-medium"
        style="background: var(--accent); color: white;">扫描</button>
    </div>
    {#if scanResult}
      <div class="mt-3 p-3 rounded-lg" style="background: {scanResult.safe ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid {scanResult.safe ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};">
        <div class="font-medium text-sm" style="color: {scanResult.safe ? '#22c55e' : '#ef4444'};">
          {scanResult.safe ? '✅ 安全' : '🚫 阻断'}
        </div>
        {#if scanResult.reason}
          <div class="text-xs mt-1" style="color: var(--text-secondary);">{scanResult.reason}</div>
        {/if}
        {#if scanResult.layers}
          <div class="mt-2 space-y-1">
            {#each Object.entries(scanResult.layers) as [layer, result]}
              <div class="text-xs flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" style="background: {layerColors[layer]};"></span>
                <span style="color: var(--text-secondary);">{layerLabels[layer]}: {(result as any).blocked ? '阻断' : '通过'}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Scan history -->
  {#if scanHistory.length > 0}
    <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border);">
      <h2 class="font-medium text-sm mb-3" style="color: var(--text-primary);">扫描历史</h2>
      <div class="space-y-2">
        {#each scanHistory as item}
          <div class="flex items-center justify-between p-2 rounded-lg" style="background: var(--bg-tertiary);">
            <div class="text-xs" style="color: var(--text-secondary);">{item.input}</div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded" style="background: {item.safe ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: {item.safe ? '#22c55e' : '#ef4444'};">
                {item.safe ? '安全' : '阻断'}
              </span>
              <span class="text-xs" style="color: var(--text-muted);">{new Date(item.time).toLocaleTimeString()}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
