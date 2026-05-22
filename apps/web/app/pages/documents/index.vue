<script setup lang="ts">
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlusIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
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
  <main class="mx-auto w-full max-w-6xl p-5">
    <OverviewHeader
      :title="t('captures.title')"
      :subtitle="t('captures.subtitle')"
    >
      <template #actions>
        <NuxtLink
          to="/"
          class="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-accent-fg shadow-card transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ t('nav.capture') }}
        </NuxtLink>
      </template>
    </OverviewHeader>

    <div class="overflow-hidden rounded-card border border-border-default bg-surface-1 shadow-card">
      <p v-if="loading" class="p-5 text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!documents.length" class="p-5 text-sm text-muted">{{ t('captures.empty') }}</p>
      <table v-else class="min-w-full divide-y divide-border-subtle">
        <thead class="bg-surface-2">
          <tr>
            <th scope="col" class="py-2 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-muted sm:pl-6">{{ t('common.title') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('common.type') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('captures.captured_at') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('captures.status') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr v-for="doc in documents" :key="doc.id" class="transition-colors hover:bg-surface-2">
            <td class="max-w-0 py-2 pl-4 pr-3 sm:pl-6">
              <NuxtLink :to="`/documents/${doc.id}`" class="block truncate text-sm font-medium text-text hover:text-accent">{{ doc.title }}</NuxtLink>
              <p v-if="doc.summary" class="mt-0.5 line-clamp-1 text-xs text-muted">
                {{ doc.summary.slice(0, 180) }}{{ doc.summary.length > 180 ? '…' : '' }}
              </p>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-sm text-text-soft">{{ doc.source_type }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ formatDate(doc.captured_at || doc.created_at) }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm">
              <UiBadge v-if="isProcessing(doc)" variant="warning">
                <ArrowPathIcon class="size-3.5 animate-spin" aria-hidden="true" />
                <span>{{ t('captures.processing') }}</span>
              </UiBadge>
              <UiBadge v-else-if="isFailed(doc)" variant="danger">
                <ExclamationTriangleIcon class="size-3.5" aria-hidden="true" />
                <span>{{ t('captures.failed') }}</span>
              </UiBadge>
              <span v-else class="text-text-soft">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div ref="sentinelRef" :class="loadingMore ? 'py-2 text-center' : ''" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">{{ t('common.loading') }}</span>
      </div>
    </div>
  </main>
</template>
