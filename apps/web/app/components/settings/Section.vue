<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  /** Render destructive sections in danger-toned heading. */
  danger?: boolean
}>(), { danger: false })
</script>

<template>
  <section>
    <h2
      :class="[
        'text-base font-semibold',
        danger ? 'text-danger' : 'text-text-strong'
      ]"
    >{{ title }}</h2>
    <p v-if="description" class="mt-1 text-sm leading-6 text-muted">{{ description }}</p>
    <div class="mt-6">
      <slot />
    </div>
  </section>
</template>
