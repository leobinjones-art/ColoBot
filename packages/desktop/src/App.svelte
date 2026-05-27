<script lang="ts">
  import Sidebar from './components/Sidebar.svelte'
  import { currentRoute, theme } from './stores'

  const routes: Record<string, any> = import.meta.glob('./routes/*.svelte', { eager: true })

  $: page = (() => {
    const path = $currentRoute
    const name = path === '/' ? 'Chat' : path.split('/').pop()!.charAt(0).toUpperCase() + path.split('/').pop()!.slice(1)
    const key = `./routes/${name}.svelte`
    return routes[key]?.default || routes['./routes/Chat.svelte']?.default
  })()
</script>

<div class="flex h-screen w-screen overflow-hidden">
  <Sidebar />
  <main class="flex-1 overflow-auto" style="background: var(--bg-primary);">
    <svelte:component this={page} />
  </main>
</div>
