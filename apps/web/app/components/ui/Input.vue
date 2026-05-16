<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '~/utils/cn'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  invalid?: boolean
  size?: 'sm' | 'md'
}>(), { modelValue: '', invalid: false, size: 'md' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const base = 'block w-full rounded-md border bg-surface-1 text-text placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60'
const sizeClasses = computed(() => props.size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm')
const borderClasses = computed(() => props.invalid
  ? 'border-danger focus:border-danger focus:ring-danger/20'
  : 'border-border-strong focus:border-accent')

const classes = computed(() => cn(base, sizeClasses.value, borderClasses.value, (attrs.class as string) || ''))
</script>

<template>
  <input
    v-bind="attrs"
    :class="classes"
    :value="modelValue ?? ''"
    :aria-invalid="invalid || undefined"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>
