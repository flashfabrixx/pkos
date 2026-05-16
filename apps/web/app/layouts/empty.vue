<script setup lang="ts">
// Same titleTemplate as the default layout so login + setup get the
// "· BKOS" suffix too.
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · BKOS` : 'BKOS')
})
</script>

<template>
  <slot />
</template>
