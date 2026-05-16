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
  <section v-if="documents.length" class="space-y-2">
    <div class="flex items-center gap-2">
      <DocumentTextIcon class="size-5 text-muted" aria-hidden="true" />
      <h2 class="text-sm font-semibold text-text-strong">{{ headingText }}</h2>
      <span class="text-xs text-muted">{{ documents.length }}</span>
    </div>
    <ul class="divide-y divide-border-subtle">
      <li v-for="doc in documents" :key="doc.id" class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 py-2">
        <span class="mt-0.5 inline-flex size-5 items-center justify-center text-muted">
          <component :is="sourceTypeIcon(doc.source_type)" class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <NuxtLink :to="`/documents/${doc.id}`" class="block truncate text-sm font-medium text-text-strong hover:text-accent">
            {{ doc.title }}
          </NuxtLink>
          <p v-if="doc.summary" class="mt-0.5 line-clamp-2 text-xs text-muted">
            {{ doc.summary.slice(0, 160) }}{{ doc.summary.length > 160 ? '…' : '' }}
          </p>
        </div>
        <span class="shrink-0 text-xs tabular-nums text-muted">{{ formatDate(doc.captured_at || doc.created_at) }}</span>
      </li>
    </ul>
  </section>
</template>
