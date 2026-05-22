<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import {
  ArchiveBoxIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
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
  { to: '/settings/integrations', label: t('settings.nav_integrations'), icon: DevicePhoneMobileIcon },
  { to: '/settings/webhooks', label: t('settings.nav_webhooks'), icon: GlobeAltIcon },
  { to: '/settings/clipper', label: t('settings.nav_clipper'), icon: BookmarkIcon },
  { to: '/settings/data', label: t('settings.nav_data'), icon: ArchiveBoxIcon }
])

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div>
    <h1 class="sr-only">{{ t('settings.title') }}</h1>

    <!-- Secondary navigation as underlined tabs. The strip's border-b
         doubles as the divider between sub-nav and content. -->
    <header class="sticky top-0 z-10 border-b border-border-default bg-app/95 backdrop-blur supports-[backdrop-filter]:bg-app/80">
      <nav class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul
          role="list"
          class="-mb-px flex gap-x-6 overflow-x-auto whitespace-nowrap text-sm font-medium"
          aria-label="Settings"
        >
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              :class="[
                'inline-flex items-center gap-x-2 border-b-2 px-1 pb-3 pt-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive(item.to)
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:border-border-strong hover:text-text'
              ]"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <component
                :is="item.icon"
                class="size-4 shrink-0"
                :class="isActive(item.to) ? 'text-accent' : 'text-muted-soft'"
                aria-hidden="true"
              />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Section stack. Each child <SettingsSection> renders its own
         grid (title left on page bg, content card right). -->
    <div class="divide-y divide-border-subtle">
      <slot />
    </div>
  </div>
</template>
