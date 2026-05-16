<script setup lang="ts">
import {
  ChartBarSquareIcon,
  ComputerDesktopIcon,
  Cog6ToothIcon,
  FolderIcon,
  HashtagIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PencilSquareIcon,
  QueueListIcon,
  RectangleStackIcon,
  SunIcon,
  TrashIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const { choice, cycle } = useTheme()
const { locale, setLocale, available } = useLocaleSwitch()

const themeIcon = computed(() =>
  choice.value === 'dark' ? MoonIcon : choice.value === 'light' ? SunIcon : ComputerDesktopIcon
)
const themeLabel = computed(() => t(`common.${choice.value}`))

function nextLocale() {
  const i = available.indexOf(locale.value as 'en' | 'de')
  const next = available[(i + 1) % available.length]
  if (next) setLocale(next)
}

const open = defineModel<boolean>('commandPaletteOpen', { default: false })

const { data } = await useFetch<{ actions: Array<{ id: string }> }>('/api/actions', {
  query: { status: 'open' },
  server: false
})
const openActions = computed(() => data.value?.actions.length || 0)

function openCommandPalette() {
  open.value = true
}

const navItems = computed(() => [
  { to: '/', label: t('nav.capture'), icon: PencilSquareIcon },
  { to: '/documents', label: t('nav.captures'), icon: InboxIcon },
  { to: '/actions', label: t('nav.actions'), icon: QueueListIcon, badge: () => openActions.value },
  { to: '/people', label: t('nav.people'), icon: UsersIcon },
  { to: '/projects', label: t('nav.projects'), icon: FolderIcon },
  { to: '/tags', label: t('nav.tags'), icon: HashtagIcon },
  { to: '/graph', label: t('nav.graph'), icon: ChartBarSquareIcon },
  { to: '/trash', label: t('nav.trash'), icon: TrashIcon },
  { to: '/settings', label: t('nav.settings'), icon: Cog6ToothIcon }
])

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
      <span>{{ t('nav.search') }}</span>
      <kbd class="app-sidebar-kbd">⌘K</kbd>
    </button>

    <nav class="app-sidebar-nav">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to as string"
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
      <button type="button" class="app-sidebar-theme" :title="`Theme: ${themeLabel} (click to cycle)`" @click="cycle">
        <component :is="themeIcon" class="size-4" aria-hidden="true" />
        <span>{{ themeLabel }}</span>
      </button>
      <button type="button" class="app-sidebar-theme" :title="`Locale: ${locale} (click to cycle)`" @click="nextLocale">
        <span class="app-sidebar-locale-code">{{ String(locale).toUpperCase() }}</span>
      </button>
      <div class="app-sidebar-footer-user-row">
        <span class="app-sidebar-footer-label">Signed in</span>
        <span class="app-sidebar-footer-user">marcel</span>
      </div>
    </div>
  </aside>
</template>
