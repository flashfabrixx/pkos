<script setup lang="ts">
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InboxIcon
} from '@heroicons/vue/24/outline'
import { sourceTypeIcon } from '~/utils/source-type'

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

const { data, pending } = await useFetch<{ documents: DocRow[] }>('/api/documents')
const documents = computed(() => data.value?.documents || [])

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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Inbox</p>
            <h1>Documents</h1>
          </div>
        </div>

        <p v-if="pending" class="muted">Loading…</p>
        <p v-else-if="!documents.length" class="muted">No documents captured yet.</p>

        <ul v-else class="doc-list inbox-list">
          <li v-for="doc in documents" :key="doc.id" class="doc-list-row inbox-row">
            <span class="doc-row-marker">
              <component :is="sourceTypeIcon(doc.source_type)" class="size-4 text-slate-500" aria-hidden="true" />
            </span>
            <div class="doc-row-body">
              <NuxtLink :to="`/documents/${doc.id}`" class="entity-doc-link inbox-title-link">
                <span class="doc-row-title">{{ doc.title }}</span>
              </NuxtLink>
              <small v-if="doc.summary">{{ doc.summary.slice(0, 180) }}{{ doc.summary.length > 180 ? '…' : '' }}</small>
            </div>
            <div class="inbox-meta">
              <span v-if="isProcessing(doc)" class="status-pill status-pill--pending">
                <ArrowPathIcon class="size-3.5 status-pill-spin" aria-hidden="true" />
                <span>Processing</span>
              </span>
              <span v-else-if="isFailed(doc)" class="status-pill status-pill--error">
                <ExclamationTriangleIcon class="size-3.5" aria-hidden="true" />
                <span>Failed</span>
              </span>
              <span class="inbox-source">{{ doc.source_type }}</span>
              <span class="entity-doc-date">{{ formatDate(doc.captured_at || doc.created_at) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
