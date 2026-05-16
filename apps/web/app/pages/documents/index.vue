<script setup lang="ts">
import {
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { sourceTypeIcon } from '~/utils/source-type'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('captures.title') })

interface DocRow {
  id: string
  title: string
  source_type: string
  summary: string | null
  status: string
  captured_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

const { items: documents, loading, loadingMore, hasMore, sentinelRef } = useInfiniteList<DocRow>({
  pageSize: 50,
  async fetcher({ offset, limit }) {
    const data = await $fetch<{ documents: DocRow[], hasMore: boolean }>('/api/documents', {
      query: { offset, limit }
    })
    return { items: data.documents, hasMore: data.hasMore }
  }
})

const PROCESSING_STATES = new Set(['new', 'queued', 'processing'])
function isProcessing(doc: DocRow) {
  return PROCESSING_STATES.has(doc.status)
}
function isFailed(doc: DocRow) {
  return doc.status === 'failed'
}

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}
</script>

<template>
  <main class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4">
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('captures.eyebrow') }}</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('captures.title') }}</h1>
      </header>

      <p v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!documents.length" class="text-sm text-muted">{{ t('captures.empty') }}</p>

      <ul v-else class="divide-y divide-border-subtle">
        <li v-for="doc in documents" :key="doc.id" class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 py-3 transition-colors hover:bg-surface-2">
          <span class="mt-1 inline-flex size-5 items-center justify-center text-muted">
            <component :is="sourceTypeIcon(doc.source_type)" class="size-4" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <NuxtLink :to="`/documents/${doc.id}`" class="block truncate text-sm font-semibold text-text-strong hover:text-accent">
              {{ doc.title }}
            </NuxtLink>
            <p v-if="doc.summary" class="mt-0.5 line-clamp-2 text-xs text-muted">
              {{ doc.summary.slice(0, 180) }}{{ doc.summary.length > 180 ? '…' : '' }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2 text-xs text-muted">
            <UiBadge v-if="isProcessing(doc)" variant="warning">
              <ArrowPathIcon class="size-3.5 animate-spin" aria-hidden="true" />
              <span>{{ t('captures.processing') }}</span>
            </UiBadge>
            <UiBadge v-else-if="isFailed(doc)" variant="danger">
              <ExclamationTriangleIcon class="size-3.5" aria-hidden="true" />
              <span>{{ t('captures.failed') }}</span>
            </UiBadge>
            <span class="uppercase tracking-wider text-[10px] font-semibold text-muted-soft">{{ doc.source_type }}</span>
            <span class="tabular-nums">{{ formatDate(doc.captured_at || doc.created_at) }}</span>
          </div>
        </li>
      </ul>

      <div ref="sentinelRef" class="py-4 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">Loading more…</span>
        <span v-else-if="!hasMore && documents.length" class="text-xs text-muted">End of list</span>
      </div>
    </section>
  </main>
</template>
