<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import {
  ArchiveBoxIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  GlobeAltIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()

interface NavItem {
  to: string
  label: string
  icon: FunctionalComponent
}

const navItems = computed<NavItem[]>(() => [
  { to: '/settings', label: t('settings.nav_general'), icon: Cog6ToothIcon },
  { to: '/settings/webhooks', label: t('settings.nav_webhooks'), icon: GlobeAltIcon },
  { to: '/settings/clipper', label: t('settings.nav_clipper'), icon: BookmarkIcon },
  { to: '/settings/data', label: t('settings.nav_data'), icon: ArchiveBoxIcon }
])

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="mx-auto max-w-7xl lg:flex lg:gap-x-16 lg:px-8">
    <h1 class="sr-only">{{ t('settings.title') }}</h1>

    <aside class="flex overflow-x-auto border-b border-border-subtle py-4 lg:block lg:w-64 lg:flex-none lg:border-0 lg:py-12">
      <nav class="flex-none px-4 sm:px-6 lg:px-0">
        <ul role="list" class="flex gap-x-3 gap-y-1 whitespace-nowrap lg:flex-col">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              :class="[
                'group flex gap-x-3 rounded-md py-2 pl-2 pr-3 text-sm font-semibold transition-colors',
                isActive(item.to)
                  ? 'bg-soft text-accent'
                  : 'text-text-soft hover:bg-soft hover:text-accent'
              ]"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <component
                :is="item.icon"
                :class="[
                  'size-5 shrink-0 transition-colors',
                  isActive(item.to)
                    ? 'text-accent'
                    : 'text-muted group-hover:text-accent'
                ]"
                aria-hidden="true"
              />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </aside>

    <main class="px-4 py-10 sm:px-6 lg:flex-auto lg:px-0 lg:py-12">
      <div class="mx-auto max-w-2xl space-y-12 sm:space-y-16 lg:mx-0 lg:max-w-none">
        <slot />
      </div>
    </main>
  </div>
</template>
