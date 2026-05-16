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
  <div class="app-shell" :class="{ 'is-mobile-open': mobileNavOpen }">
    <button
      type="button"
      class="app-mobile-menu"
      :aria-expanded="mobileNavOpen"
      :aria-label="mobileNavOpen ? 'Close menu' : 'Open menu'"
      @click="mobileNavOpen = !mobileNavOpen"
    >
      <component :is="mobileNavOpen ? XMarkIcon : Bars3Icon" class="size-5" aria-hidden="true" />
    </button>

    <div
      v-if="mobileNavOpen"
      class="app-mobile-backdrop"
      aria-hidden="true"
      @click="mobileNavOpen = false"
    ></div>

    <AppSidebar v-model:command-palette-open="commandPaletteOpen" />
    <main class="app-main">
      <slot />
    </main>
    <CommandPalette v-model:open="commandPaletteOpen" />
  </div>
</template>
