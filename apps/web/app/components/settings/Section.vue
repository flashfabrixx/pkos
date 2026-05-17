<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  /** Render destructive sections in danger-toned heading + card border. */
  danger?: boolean
}>(), { danger: false })
</script>

<template>
  <section class="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-6 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
    <!-- Left column: title + description sit on the page background
         (bg-app), establishing the contrast with the card on the right. -->
    <div class="md:pr-4">
      <h2
        :class="[
          'text-base font-semibold leading-7',
          danger ? 'text-danger' : 'text-text-strong'
        ]"
      >{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm leading-6 text-muted">{{ description }}</p>
    </div>

    <!-- Right column: content wrapped in a card so the visual hierarchy
         (page bg → card surface) is clear. -->
    <div class="md:col-span-2">
      <div
        :class="[
          'rounded-card border bg-surface-1 p-6 shadow-card sm:p-8',
          danger ? 'border-danger-border' : 'border-border-default'
        ]"
      >
        <slot />
      </div>
    </div>
  </section>
</template>
