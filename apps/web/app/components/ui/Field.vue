<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
  for?: string
}>()

const generatedId = useId()
const fieldId = computed(() => props.for || `field-${generatedId}`)
const hintId = computed(() => props.hint ? `${fieldId.value}-hint` : undefined)
const errorId = computed(() => props.error ? `${fieldId.value}-error` : undefined)
const describedBy = computed(() => [hintId.value, errorId.value].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div class="grid gap-1.5">
    <label v-if="label" :for="fieldId" class="inline-flex items-baseline gap-1 text-xs font-semibold text-text-soft">
      <span>{{ label }}</span>
      <span v-if="required" aria-hidden="true" class="font-bold text-danger">*</span>
    </label>
    <slot :id="fieldId" :aria-describedby="describedBy" :aria-invalid="error ? true : undefined" />
    <p v-if="hint && !error" :id="hintId" class="text-xs text-muted">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
