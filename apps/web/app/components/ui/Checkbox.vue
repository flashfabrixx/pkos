<script setup lang="ts">
/**
 * Subtle checkbox with custom SVG indicator. Replaces the browser
 * default so border + accent color follow the design tokens reliably
 * across light and dark themes (UA styles otherwise override the
 * border-color we set via Tailwind on a native checkbox).
 *
 * Visual indeterminate state shows a horizontal stroke instead of
 * the checkmark; the native input's indeterminate property is also
 * set so assistive tech reports it correctly.
 */
const props = defineProps<{
  modelValue?: boolean
  indeterminate?: boolean
  ariaLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
watchEffect(() => {
  if (inputRef.value) inputRef.value.indeterminate = !!props.indeterminate
})

const visuallyFilled = computed(() => props.modelValue || props.indeterminate)

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
  emit('change', target.checked)
}
</script>

<template>
  <span class="inline-grid size-4 place-items-center align-middle">
    <input
      ref="inputRef"
      type="checkbox"
      :class="[
        'col-start-1 row-start-1 size-4 appearance-none rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40',
        visuallyFilled
          ? 'border-accent bg-accent'
          : 'border-gray-300 bg-surface-1 dark:border-white/20 dark:bg-surface-2'
      ]"
      :checked="modelValue"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @change="onChange"
    >
    <svg
      v-if="visuallyFilled"
      class="pointer-events-none col-start-1 row-start-1 size-3 self-center justify-self-center text-accent-fg"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        v-if="indeterminate"
        d="M3 7H11"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else
        d="M3 8L6 11L11 3.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>
