<script setup lang="ts">
import { DocumentTextIcon } from '@heroicons/vue/24/outline'
import { sourceTypeIcon } from '~/utils/source-type'

interface DocRow {
  id: string
  title: string
  source_type: string
  captured_at: string | null
  created_at: string
  summary: string | null
}

const props = defineProps<{
  documents: DocRow[]
  title?: string
}>()

const headingText = computed(() => props.title || 'Documents')

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}
</script>

<template>
  <section v-if="documents.length" class="doc-section">
    <div class="doc-section-head">
      <div class="doc-section-title">
        <DocumentTextIcon class="size-5 text-slate-500" aria-hidden="true" />
        <h2>{{ headingText }}</h2>
        <span class="count">{{ documents.length }}</span>
      </div>
    </div>
    <ul class="doc-list">
      <li v-for="doc in documents" :key="doc.id" class="doc-list-row entity-doc-row">
        <span class="doc-row-marker">
          <component :is="sourceTypeIcon(doc.source_type)" class="size-4 text-slate-500" aria-hidden="true" />
        </span>
        <div class="doc-row-body">
          <NuxtLink :to="`/documents/${doc.id}`" class="entity-doc-link">
            <span class="doc-row-title">{{ doc.title }}</span>
          </NuxtLink>
          <small v-if="doc.summary">{{ doc.summary.slice(0, 160) }}{{ doc.summary.length > 160 ? '…' : '' }}</small>
        </div>
        <span class="entity-doc-date">{{ formatDate(doc.captured_at || doc.created_at) }}</span>
      </li>
    </ul>
  </section>
</template>
