<script setup lang="ts">
/**
 * Shared header for all overview / index pages. Carries the page
 * title, a one-line subtitle explaining what the collection is, and
 * a right-aligned slot for primary actions (e.g. "Add person").
 *
 * Used by:
 *   - documents (Captures)
 *   - people
 *   - departments
 *   - projects
 *   - tags
 */
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="mb-6 sm:flex sm:items-center sm:gap-6">
    <div class="sm:flex-auto">
      <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1.5 text-sm text-text-soft">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="mt-4 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-none">
      <slot name="actions" />
    </div>
  </header>
</template>
