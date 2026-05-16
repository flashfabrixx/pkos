<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '~/utils/cn'

type Variant = 'ghost' | 'secondary' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(defineProps<{
  ariaLabel: string
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}>(), {
  variant: 'ghost',
  size: 'md',
  type: 'button',
  disabled: false
})

const base = 'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<Variant, string> = {
  ghost: 'text-text-soft hover:bg-surface-3',
  secondary: 'bg-surface-1 text-text border border-border-default hover:bg-surface-3',
  danger: 'text-danger hover:bg-danger-soft'
}

const sizeClasses: Record<Size, string> = {
  sm: 'size-8',
  md: 'size-9'
}

const classes = computed(() => cn(base, variantClasses[props.variant], sizeClasses[props.size]))
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :aria-label="ariaLabel"
    :data-variant="variant"
    :data-size="size"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
