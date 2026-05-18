<script setup lang="ts">
// Same titleTemplate as the default layout so login + setup get the
// "· PKOS" suffix too.
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · PKOS` : 'PKOS')
})
</script>

<template>
  <slot />
</template>
