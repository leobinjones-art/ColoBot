import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/layout/MainLayout.vue'),
      redirect: '/chat',
      children: [
        // 核心
        {
          path: 'chat',
          name: 'Chat',
          component: () => import('@/views/ChatConsole.vue'),
          meta: { title: 'Chat' },
        },
        {
          path: 'agents',
          name: 'Agents',
          component: () => import('@/views/Agents.vue'),
          meta: { title: 'Agents' },
        },
        {
          path: 'skills',
          name: 'Skills',
          component: () => import('@/views/Skills.vue'),
          meta: { title: 'Skills' },
        },
        // 安全守护
        {
          path: 'sentinel',
          name: 'Sentinel',
          component: () => import('@/views/Sentinel.vue'),
          meta: { title: 'Sentinel' },
        },
        // 个人助理
        {
          path: 'assistant',
          component: () => import('@/views/Assistant/Layout.vue'),
          redirect: '/assistant/todos',
          children: [
            {
              path: 'todos',
              name: 'Todos',
              component: () => import('@/views/Assistant/Todos.vue'),
              meta: { title: 'Todos' },
            },
            {
              path: 'reminders',
              name: 'Reminders',
              component: () => import('@/views/Assistant/Reminders.vue'),
              meta: { title: 'Reminders' },
            },
            {
              path: 'calendar',
              name: 'Calendar',
              component: () => import('@/views/Assistant/Calendar.vue'),
              meta: { title: 'Calendar' },
            },
            {
              path: 'notes',
              name: 'Notes',
              component: () => import('@/views/Assistant/Notes.vue'),
              meta: { title: 'Notes' },
            },
            {
              path: 'habits',
              name: 'Habits',
              component: () => import('@/views/Assistant/Habits.vue'),
              meta: { title: 'Habits' },
            },
            {
              path: 'moods',
              name: 'Moods',
              component: () => import('@/views/Assistant/Moods.vue'),
              meta: { title: 'Moods' },
            },
            {
              path: 'finances',
              name: 'Finances',
              component: () => import('@/views/Assistant/Finances.vue'),
              meta: { title: 'Finances' },
            },
            {
              path: 'goals',
              name: 'Goals',
              component: () => import('@/views/Assistant/Goals.vue'),
              meta: { title: 'Goals' },
            },
            {
              path: 'contacts',
              name: 'Contacts',
              component: () => import('@/views/Assistant/Contacts.vue'),
              meta: { title: 'Contacts' },
            },
          ],
        },
        // 设置
        {
          path: 'settings',
          component: () => import('@/views/Settings/Layout.vue'),
          redirect: '/settings/models',
          children: [
            {
              path: 'models',
              name: 'SettingsModels',
              component: () => import('@/views/Settings/Models.vue'),
              meta: { title: 'Settings - Models' },
            },
            {
              path: 'system',
              name: 'SettingsSystem',
              component: () => import('@/views/Settings/System.vue'),
              meta: { title: 'Settings - System' },
            },
          ],
        },
      ],
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chat',
    },
  ],
})

router.beforeEach((to, _from, next) => {
  if (to.name === 'Login' && isLoggedIn()) {
    next({ path: '/' })
  } else if (to.name !== 'Login' && !isLoggedIn()) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router