<script setup lang="ts">
import {
  ChartBarSquareIcon,
  Cog6ToothIcon,
  FolderIcon,
  HashtagIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  QueueListIcon,
  RectangleStackIcon,
  TrashIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'

const open = defineModel<boolean>('commandPaletteOpen', { default: false })

const { data } = await useFetch<{ actions: Array<{ id: string }> }>('/api/actions', {
  query: { status: 'open' },
  server: false
})
const openActions = computed(() => data.value?.actions.length || 0)

function openCommandPalette() {
  open.value = true
}

const navItems = [
  { to: '/', label: 'Capture', icon: PencilSquareIcon },
  { to: '/documents', label: 'Captures', icon: InboxIcon },
  { to: '/actions', label: 'Actions', icon: QueueListIcon, badge: () => openActions.value },
  { to: '/people', label: 'People', icon: UsersIcon },
  { to: '/projects', label: 'Projects', icon: FolderIcon },
  { to: '/tags', label: 'Tags', icon: HashtagIcon },
  { to: '/graph', label: 'Graph', icon: ChartBarSquareIcon },
  { to: '/trash', label: 'Trash', icon: TrashIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon }
] as const

const route = useRoute()
function isItemActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar-brand">
      <NuxtLink class="app-sidebar-logo" to="/">
        <RectangleStackIcon class="size-5 text-blue-600" aria-hidden="true" />
        <span>BKOS</span>
      </NuxtLink>
    </div>

    <button
      type="button"
      class="app-sidebar-search"
      @click="openCommandPalette"
    >
      <MagnifyingGlassIcon class="size-4" aria-hidden="true" />
      <span>Search</span>
      <kbd class="app-sidebar-kbd">⌘K</kbd>
    </button>

    <nav class="app-sidebar-nav">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="app-sidebar-nav-item"
        :class="{ 'is-active': isItemActive(item.to) }"
      >
        <component :is="item.icon" class="size-4" aria-hidden="true" />
        <span class="app-sidebar-nav-label">{{ item.label }}</span>
        <span
          v-if="'badge' in item && item.badge && item.badge()"
          class="app-sidebar-nav-badge"
        >{{ item.badge() }}</span>
      </NuxtLink>
    </nav>

    <div class="app-sidebar-footer">
      <span class="app-sidebar-footer-label">Signed in</span>
      <span class="app-sidebar-footer-user">marcel</span>
    </div>
  </aside>
</template>
