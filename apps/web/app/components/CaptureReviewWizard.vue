<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

/**
 * Inline review wizard for a single capture. Lives at the top of
 * documents/[id].vue. Pulls the open reviews for this document, lets
 * the user resolve each one with a 3-button verdict, and emits a
 * "resolved" event so the parent can refresh dependent data
 * (entity lists, mentions etc.) after the merge.
 */

const props = defineProps<{
  documentId: string
}>()

const emit = defineEmits<{
  (e: 'resolved'): void
}>()

const { t } = useI18n()

interface ReviewRow {
  id: string
  document_id: string
  kind: string
  payload: { extractedName?: string, entityType?: string }
  suggestion: {
    newEntityId?: string
    candidateEntityId?: string
    candidateName?: string
    similarity?: number
  }
  status: string
  created_at: string
}

const reviews = ref<ReviewRow[]>([])
const expanded = ref(false)
const pending = ref<Set<string>>(new Set())

async function load() {
  const r = await $fetch<{ reviews: ReviewRow[], count: number }>('/api/reviews', {
    query: { documentId: props.documentId }
  })
  reviews.value = r.reviews
  // Auto-expand on first load when there are reviews; collapsed
  // afterwards stays sticky per page visit.
  if (reviews.value.length && !expanded.value) expanded.value = true
}

onMounted(load)

async function resolve(review: ReviewRow, action: 'confirm' | 'reject' | 'skip') {
  if (pending.value.has(review.id)) return
  pending.value = new Set([...pending.value, review.id])
  try {
    await $fetch(`/api/reviews/${review.id}/resolve`, {
      method: 'POST',
      body: { action }
    })
    reviews.value = reviews.value.filter((r) => r.id !== review.id)
    emit('resolved')
  } catch (error) {
    console.error('Failed to resolve review', error)
  } finally {
    const next = new Set(pending.value)
    next.delete(review.id)
    pending.value = next
  }
}

function similarityPercent(sim: number | undefined): string {
  if (typeof sim !== 'number') return ''
  return `${Math.round(sim * 100)}%`
}
</script>

<template>
  <section
    v-if="reviews.length"
    class="rounded-card border border-warning-border bg-warning-soft"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-text"
      @click="expanded = !expanded"
    >
      <QuestionMarkCircleIcon class="size-4 text-warning" aria-hidden="true" />
      <span class="flex-1">
        {{ t('reviews.headline', { n: reviews.length }, reviews.length) }}
      </span>
      <ChevronDownIcon
        class="size-4 text-muted transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>

    <div v-if="expanded" class="space-y-2 border-t border-warning-border px-4 py-3">
      <div
        v-for="review in reviews"
        :key="review.id"
        class="rounded-card bg-surface-1 p-3"
      >
        <template v-if="review.kind === 'entity_match'">
          <p class="text-sm text-text">
            {{ t('reviews.entity_match.question', {
              extracted: review.payload.extractedName,
              candidate: review.suggestion.candidateName
            }) }}
            <span v-if="review.suggestion.similarity" class="ml-1 text-xs text-muted">({{ similarityPercent(review.suggestion.similarity) }})</span>
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-60"
              :disabled="pending.has(review.id)"
              @click="resolve(review, 'confirm')"
            >
              <CheckIcon class="size-3.5" aria-hidden="true" />
              {{ t('reviews.entity_match.confirm') }}
            </button>
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-default bg-surface-1 px-3 text-xs font-medium text-text transition-colors hover:bg-surface-3 disabled:opacity-60"
              :disabled="pending.has(review.id)"
              @click="resolve(review, 'reject')"
            >
              {{ t('reviews.entity_match.reject') }}
            </button>
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-60"
              :disabled="pending.has(review.id)"
              @click="resolve(review, 'skip')"
            >
              <XMarkIcon class="size-3.5" aria-hidden="true" />
              {{ t('reviews.skip') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
