<script setup lang="ts">
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

const commandPaletteOpen = ref(false)
const mobileNavOpen = ref(false)
const route = useRoute()

const { hydrateFromStorage } = useTheme()
onMounted(() => hydrateFromStorage())

// Pages call `useHead({ title: 'Foo' })`; we render `Foo · BKOS`. When
// a page sets no title we fall back to plain `BKOS`.
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · BKOS` : 'BKOS')
})

// Close the mobile drawer when navigating to a new route.
watch(() => route.fullPath, () => { mobileNavOpen.value = false })
</script>

<template>
  <div
    class="group/shell grid min-h-screen md:grid-cols-[220px_minmax(0,1fr)]"
    :data-mobile-open="mobileNavOpen ? 'true' : 'false'"
  >
    <button
      type="button"
      class="fixed left-3 top-3 z-40 hidden size-10 items-center justify-center rounded-card border border-border-default bg-surface-1 text-text shadow-card max-md:inline-flex"
      :aria-expanded="mobileNavOpen"
      :aria-label="mobileNavOpen ? 'Close menu' : 'Open menu'"
      @click="mobileNavOpen = !mobileNavOpen"
    >
      <component :is="mobileNavOpen ? XMarkIcon : Bars3Icon" class="size-5" aria-hidden="true" />
    </button>

    <div
      v-if="mobileNavOpen"
      class="fixed inset-0 z-20 bg-slate-900/45 md:hidden"
      aria-hidden="true"
      @click="mobileNavOpen = false"
    ></div>

    <AppSidebar v-model:command-palette-open="commandPaletteOpen" />
    <main class="min-w-0 max-md:pt-14">
      <slot />
    </main>
    <CommandPalette v-model:open="commandPaletteOpen" />
  </div>
</template>
