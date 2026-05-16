<script setup lang="ts">
import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline'

interface Suggestion {
  id: string
  target_id: string
  target_name: string
  target_type: string
  score: number
  reason: string
}

const props = defineProps<{ entityId: string, entityType: 'person' | 'project' | 'tag' }>()
const emit = defineEmits<{ (e: 'merge', payload: { suggestionId: string, targetId: string }): void }>()

const { data, refresh } = await useFetch<{ suggestions: Suggestion[] }>(`/api/entities/${props.entityId}/suggestions`)
const suggestions = computed(() => data.value?.suggestions || [])

async function dismiss(id: string) {
  await $fetch(`/api/entities/suggestions/${id}/dismiss`, { method: 'POST' })
  await refresh()
}

function startMerge(s: Suggestion) {
  emit('merge', { suggestionId: s.id, targetId: s.target_id })
}
</script>

<template>
  <section v-if="suggestions.length" class="space-y-2 rounded-card border border-warning-border bg-warning-soft p-3">
    <header class="space-y-0.5">
      <h3 class="text-sm font-semibold text-warning">Possible duplicates</h3>
      <p class="text-xs text-text-soft">Computed nightly from embeddings. Accept to merge, dismiss to ignore for 30 days.</p>
    </header>
    <ul class="space-y-2">
      <li v-for="s in suggestions" :key="s.id" class="rounded-md bg-surface-1 p-2">
        <div class="mb-2 space-y-0.5">
          <strong class="block truncate text-sm text-text">{{ s.target_name }}</strong>
          <span class="text-xs text-muted">{{ s.target_type }} · score {{ (s.score * 100).toFixed(0) }}</span>
        </div>
        <div class="flex gap-1.5">
          <UiButton size="sm" variant="secondary" @click="startMerge(s)">
            <ArrowsRightLeftIcon class="size-4" aria-hidden="true" />
            Merge
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="dismiss(s.id)">
            <XMarkIcon class="size-4" aria-hidden="true" />
            Dismiss
          </UiButton>
        </div>
      </li>
    </ul>
  </section>
</template>
