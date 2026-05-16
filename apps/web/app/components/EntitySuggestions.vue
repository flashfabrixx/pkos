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
  <section v-if="suggestions.length" class="entity-suggestions">
    <header class="entity-suggestions-head">
      <h3>Possible duplicates</h3>
      <p class="muted">Computed nightly from embeddings. Accept to merge, dismiss to ignore for 30 days.</p>
    </header>
    <ul>
      <li v-for="s in suggestions" :key="s.id" class="entity-suggestion-row">
        <div class="entity-suggestion-main">
          <strong>{{ s.target_name }}</strong>
          <span class="muted">{{ s.target_type }} · score {{ (s.score * 100).toFixed(0) }}</span>
        </div>
        <div class="entity-suggestion-actions">
          <button type="button" class="entity-suggestion-btn" @click="startMerge(s)">
            <ArrowsRightLeftIcon class="size-4" aria-hidden="true" />
            Merge
          </button>
          <button type="button" class="entity-suggestion-btn entity-suggestion-btn--ghost" @click="dismiss(s.id)">
            <XMarkIcon class="size-4" aria-hidden="true" />
            Dismiss
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
