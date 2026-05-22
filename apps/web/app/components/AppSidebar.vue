<script setup lang="ts">
import {
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  FolderIcon,
  HashtagIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  QueueListIcon,
  RectangleStackIcon,
  TrashIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'
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

interface NavItem {
  to: string
  label: string
  icon: Component
  badge?: () => number
  /**
   * Hover-revealed quick-create shortcut. The plus button is rendered
   * inside the row but stops propagation so it doesn't fight the link.
   */
  createHref?: string
  createLabel?: string
}

const navItems = computed<NavItem[]>(() => [
  {
    to: '/threads',
    label: t('nav.threads'),
    icon: ChatBubbleLeftRightIcon,
    createHref: '/threads?new=1',
    createLabel: t('threads.new')
  },
  { to: '/actions', label: t('nav.actions'), icon: QueueListIcon, badge: () => openActions.value },
  {
    to: '/documents',
    label: t('nav.captures'),
    icon: InboxIcon,
    createHref: '/',
    createLabel: t('nav.capture')
  },
  {
    to: '/people',
    label: t('nav.people'),
    icon: UsersIcon,
    createHref: '/people?new=1',
    createLabel: t('people.add')
  },
  {
    to: '/departments',
    label: t('nav.departments'),
    icon: BuildingOffice2Icon,
    createHref: '/departments?new=1',
    createLabel: t('departments.add')
  },
  {
    to: '/projects',
    label: t('nav.projects'),
    icon: FolderIcon,
    createHref: '/projects?new=1',
    createLabel: t('projects.add')
  },
  {
    to: '/tags',
    label: t('nav.tags'),
    icon: HashtagIcon,
    createHref: '/tags?new=1',
    createLabel: t('tags.add')
  },
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
      <div
        v-for="item in navItems"
        :key="item.to"
        class="group/row relative"
      >
        <NuxtLink
          :to="item.to"
          :class="[
            'inline-flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
            isItemActive(item.to)
              ? 'bg-accent-soft text-accent font-semibold'
              : 'text-text-soft hover:bg-soft hover:text-text'
          ]"
          :aria-current="isItemActive(item.to) ? 'page' : undefined"
        >
          <component :is="item.icon" class="size-4" aria-hidden="true" />
          <span class="flex-1">{{ item.label }}</span>
          <span
            v-if="item.badge && item.badge()"
            class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-accent-fg"
          >{{ item.badge() }}</span>
        </NuxtLink>
        <NuxtLink
          v-if="item.createHref"
          :to="item.createHref"
          :aria-label="item.createLabel"
          :title="item.createLabel"
          class="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-surface-3 hover:text-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-hover/row:opacity-100"
        >
          <PlusIcon class="size-3.5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </nav>

    <div class="grid gap-0.5 border-t border-border-subtle px-2.5 pb-1 pt-2.5">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">Signed in</span>
      <span class="text-[13px] font-semibold text-text">marcel</span>
    </div>
  </aside>
</template>
