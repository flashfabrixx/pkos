<script setup lang="ts">
withDefaults(defineProps<{
  padded?: boolean
  as?: string
}>(), { padded: true, as: 'section' })
</script>

<template>
  <component
    :is="as"
    class="rounded-card border border-border-default bg-surface-1 shadow-card"
  >
    <header
      v-if="$slots.header || $slots.actions"
      class="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <slot name="header" />
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div :class="padded && 'p-4'">
      <slot />
    </div>
    <footer
      v-if="$slots.footer"
      class="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3"
    >
      <slot name="footer" />
    </footer>
  </component>
</template>
