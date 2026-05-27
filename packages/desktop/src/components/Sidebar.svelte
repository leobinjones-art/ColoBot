<script lang="ts">
  import { currentRoute, sidebarCollapsed, theme } from '../stores'

  const navGroups = [
    { label: '智能', items: [
      { path: '/chat', icon: '💬', label: '对话' },
      { path: '/agents', icon: '🤖', label: 'Agent' },
    ]},
    { label: '日程与任务', items: [
      { path: '/todos', icon: '📋', label: '待办' },
      { path: '/reminders', icon: '⏰', label: '提醒' },
      { path: '/calendar', icon: '📅', label: '日历' },
      { path: '/timetracker', icon: '⏱', label: '时间' },
    ]},
    { label: '知识记录', items: [
      { path: '/notes', icon: '📝', label: '笔记' },
      { path: '/bookmarks', icon: '🔖', label: '书签' },
      { path: '/inspiration', icon: '💡', label: '灵感' },
    ]},
    { label: '个人成长', items: [
      { path: '/goals', icon: '🎯', label: '目标' },
      { path: '/reading', icon: '📚', label: '阅读' },
      { path: '/learning', icon: '🎓', label: '学习' },
    ]},
    { label: '健康生活', items: [
      { path: '/habits', icon: '✅', label: '习惯' },
      { path: '/mood', icon: '😊', label: '心情' },
      { path: '/health', icon: '❤️', label: '健康' },
    ]},
    { label: '社交财务', items: [
      { path: '/contacts', icon: '👤', label: '联系人' },
      { path: '/finance', icon: '💰', label: '财务' },
    ]},
    { label: '工具', items: [
      { path: '/passwords', icon: '🔑', label: '密码' },
      { path: '/projects', icon: '📁', label: '项目' },
    ]},
    { label: '系统', items: [
      { path: '/sentinel', icon: '🛡️', label: '安全' },
      { path: '/logs', icon: '📋', label: '日志' },
      { path: '/charter', icon: '📜', label: '许可证' },
      { path: '/skills', icon: '⚡', label: '技能' },
    ]},
  ]
</script>

<nav class="sidebar" class:collapsed={$sidebarCollapsed}
  style="background: var(--bg-secondary); border-right: 1px solid var(--border); width: {$sidebarCollapsed ? '48px' : '200px'}; display: flex; flex-direction: column; transition: width 0.2s;">
  {#if !$sidebarCollapsed}
    <div class="flex items-center gap-2 px-4 py-3" style="border-bottom: 1px solid var(--border);">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
        style="background: var(--accent); color: white;">N</div>
      <span class="font-semibold text-sm" style="color: var(--text-primary);">ColoMind</span>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      {#each navGroups as group}
        <div class="px-3 py-1">
          <div class="text-xs font-medium mb-1" style="color: var(--text-muted);">{group.label}</div>
          {#each group.items as item}
            <button class="nav-item flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors"
              class:active={$currentRoute === item.path}
              onclick={() => $currentRoute = item.path}
              style="color: {$currentRoute === item.path ? 'var(--accent)' : 'var(--text-secondary)'}; background: {$currentRoute === item.path ? 'var(--bg-tertiary)' : 'transparent'};">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>

    <div class="px-3 py-2" style="border-top: 1px solid var(--border);">
      <button class="nav-item flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm"
        onclick={() => $currentRoute = '/settings'}
        style="color: var(--text-secondary);">
        <span>⚙️</span><span>设置</span>
      </button>
    </div>
  {:else}
    <div class="flex flex-col items-center py-3 gap-1 overflow-y-auto">
      {#each navGroups as group}
        {#each group.items as item}
          <button class="w-10 h-10 rounded-md flex items-center justify-center text-sm transition-colors"
            class:active={$currentRoute === item.path}
            onclick={() => {$currentRoute = item.path; $sidebarCollapsed = false}}
            style="background: {$currentRoute === item.path ? 'var(--bg-tertiary)' : 'transparent'};">
            {item.icon}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</nav>