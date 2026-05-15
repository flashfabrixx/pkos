<script setup lang="ts">
const commandPaletteOpen = ref(false)
</script>

<template>
  <div class="app-shell">
    <AppSidebar v-model:command-palette-open="commandPaletteOpen" />
    <main class="app-main">
      <slot />
    </main>
    <CommandPalette v-model:open="commandPaletteOpen" />
  </div>
</template>
