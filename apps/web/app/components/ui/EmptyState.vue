<script setup lang="ts">
import type { FunctionalComponent } from 'vue'

defineProps<{
  icon?: FunctionalComponent
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <component :is="icon" v-if="icon" class="size-8 text-muted-soft" aria-hidden="true" />
    <div class="space-y-1">
      <p class="text-sm font-semibold text-text-strong">{{ title }}</p>
      <p v-if="description" class="text-xs text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1">
      <slot />
    </div>
  </div>
</template>
