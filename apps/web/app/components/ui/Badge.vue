<script setup lang="ts">
type Variant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'confidential'

withDefaults(defineProps<{
  variant?: Variant
  dot?: boolean
}>(), { variant: 'neutral', dot: false })

const variantClasses: Record<Variant, string> = {
  neutral: 'bg-soft text-text-soft',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  confidential: 'bg-accent-soft text-confidential'
}

const dotClasses: Record<Variant, string> = {
  neutral: 'bg-muted',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  confidential: 'bg-confidential'
}
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', variantClasses[variant]]"
    :data-variant="variant"
  >
    <span
      v-if="dot"
      :class="['size-1.5 rounded-full', dotClasses[variant]]"
      aria-hidden="true"
    ></span>
    <slot />
  </span>
</template>
