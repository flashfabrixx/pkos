<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '~/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  type: 'button',
  disabled: false,
  block: false
})

const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-strong',
  secondary: 'bg-surface-1 text-text border border-border-default hover:bg-surface-3',
  ghost: 'text-text-soft hover:bg-surface-3',
  danger: 'bg-danger text-white hover:opacity-90'
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm'
}

const classes = computed(() => cn(base, variantClasses[props.variant], sizeClasses[props.size], props.block && 'w-full'))
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :data-variant="variant"
    :data-size="size"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <UiSpinner v-if="loading" :size="size === 'sm' ? 'sm' : 'md'" />
    <slot />
  </button>
</template>
