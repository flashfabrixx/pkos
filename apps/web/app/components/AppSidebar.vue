<script setup lang="ts">
import {
  BuildingOffice2Icon,
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  { to: '/departments', label: t('nav.departments'), icon: BuildingOffice2Icon },
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
  <aside
    class="sticky top-0 z-30 grid h-screen grid-rows-[auto_auto_1fr_auto] gap-2 border-r border-panel-border bg-surface-1 px-3 py-3.5
           max-md:fixed max-md:left-0 max-md:top-0 max-md:w-[260px] max-md:-translate-x-full max-md:shadow-popover max-md:transition-transform max-md:duration-200
           group-data-[mobile-open=true]/shell:max-md:translate-x-0"
  >
    <div class="px-2 pb-2.5 pt-1">
      <NuxtLink class="inline-flex items-center gap-2 text-sm font-extrabold tracking-wider text-text-strong" to="/">
        <RectangleStackIcon class="size-5 text-accent" aria-hidden="true" />
        <span>PKOS</span>
      </NuxtLink>
    </div>

    <button
      type="button"
      class="inline-flex h-8 w-full items-center gap-2 rounded-md border border-panel-border bg-surface-3 px-2.5 text-left text-[13px] font-medium text-muted transition-colors hover:border-border-strong hover:bg-soft hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      @click="openCommandPalette"
    >
      <MagnifyingGlassIcon class="size-4" aria-hidden="true" />
      <span class="flex-1">{{ t('nav.search') }}</span>
      <UiKbd>⌘K</UiKbd>
    </button>

    <nav class="grid content-start gap-0.5 pt-1.5">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to as string"
        :class="[
          'inline-flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
          isItemActive(item.to)
            ? 'bg-accent-soft text-accent font-semibold'
            : 'text-text-soft hover:bg-soft hover:text-text'
        ]"
        :aria-current="isItemActive(item.to) ? 'page' : undefined"
      >
        <component :is="item.icon" class="size-4" aria-hidden="true" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="'badge' in item && item.badge && item.badge()"
          class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-accent-fg"
        >{{ item.badge() }}</span>
      </NuxtLink>
    </nav>

    <div class="grid gap-0.5 border-t border-border-subtle px-2.5 pb-1 pt-2.5">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">Signed in</span>
      <span class="text-[13px] font-semibold text-text">marcel</span>
    </div>
  </aside>
</template>
