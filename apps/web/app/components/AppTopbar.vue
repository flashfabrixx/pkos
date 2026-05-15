<script setup lang="ts">
import {
  ChartBarSquareIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  RectangleStackIcon
} from '@heroicons/vue/24/outline'

const route = useRoute()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const { data } = await useFetch<{ actions: Array<{ id: string }> }>('/api/actions', {
  query: { status: 'open' },
  server: false
})
const openActions = computed(() => data.value?.actions.length || 0)
const commandPaletteOpen = ref(false)

function openCommandPalette() {
  commandPaletteOpen.value = true
}

async function submitSearch() {
  const q = query.value.trim()
  if (!q) {
    openCommandPalette()
    return
  }
  await navigateTo({ path: '/search', query: { q } })
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-5">
      <NuxtLink class="flex items-center gap-2 font-extrabold text-slate-950" to="/">
        <RectangleStackIcon class="size-5 text-blue-600" />
        <span>BKOS</span>
      </NuxtLink>

      <form class="mx-auto hidden min-w-0 max-w-xl flex-1 md:block" @submit.prevent="submitSearch">
        <label class="relative block">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="query"
            class="topbar-search-input h-9 w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="Search documents, people, projects, decisions..."
            readonly
            @click="openCommandPalette"
            @focus="openCommandPalette"
          >
          <kbd class="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 lg:block">⌘K</kbd>
        </label>
      </form>

      <nav class="flex items-center gap-1">
        <NuxtLink class="nav-link" to="/">
          <HomeIcon class="size-4" />
          <span class="hidden lg:inline">Dashboard</span>
        </NuxtLink>
        <NuxtLink class="nav-link relative" to="/actions">
          <QueueListIcon class="size-4" />
          <span class="hidden lg:inline">Actions</span>
          <span v-if="openActions" class="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ openActions }}</span>
        </NuxtLink>
        <NuxtLink class="nav-link" to="/graph">
          <ChartBarSquareIcon class="size-4" />
          <span class="hidden lg:inline">Graph</span>
        </NuxtLink>
      </nav>
    </div>
  </header>
  <CommandPalette v-model:open="commandPaletteOpen" />
</template>
