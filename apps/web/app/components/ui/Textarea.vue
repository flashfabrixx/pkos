<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '~/utils/cn'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  invalid?: boolean
  rows?: number
}>(), { modelValue: '', invalid: false, rows: 6 })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const base = 'block w-full rounded-md border bg-surface-1 text-text placeholder:text-muted-soft px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60 resize-vertical'
const borderClasses = computed(() => props.invalid
  ? 'border-danger focus:border-danger focus:ring-danger/20'
  : 'border-border-strong focus:border-accent')

const classes = computed(() => cn(base, borderClasses.value, (attrs.class as string) || ''))
</script>

<template>
  <textarea
    v-bind="attrs"
    :class="classes"
    :rows="rows"
    :value="modelValue ?? ''"
    :aria-invalid="invalid || undefined"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  ></textarea>
</template>
