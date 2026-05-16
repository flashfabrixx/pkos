<script setup lang="ts">
import { FolderIcon, HashtagIcon, UsersIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { colorFor } from '~/utils/hash-color'

const { t: _t } = useI18n()
useHead({ title: () => 'Search' })

const SOURCE_TYPES = ['meeting', 'voice_note', 'conversation', 'reflection', 'other'] as const
const LANGS = [
  { code: '', label: 'Any' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' }
]

const q = ref('')
const kinds = ref<Set<string>>(new Set())
const lang = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const searched = ref(false)
const pending = ref(false)
const mode = ref<'hybrid' | 'lexical' | 'idle'>('idle')
const results = ref<Array<{
  document_id: string
  title: string
  source_type: string
  summary: string | null
  captured_at: string | null
  excerpt: string
}>>([])
const entityHits = ref<Array<{ id: string, type: 'person' | 'project' | 'tag', name: string }>>([])

function toggleKind(kind: string) {
  if (kinds.value.has(kind)) kinds.value.delete(kind)
  else kinds.value.add(kind)
  kinds.value = new Set(kinds.value)
}

function routeForEntity(type: string, id: string) {
  if (type === 'person') return `/people/${id}`
  if (type === 'project') return `/projects/${id}`
  if (type === 'tag') return `/tags/${id}`
  return '/'
}

function entityIcon(type: string) {
  if (type === 'person') return UsersIcon
  if (type === 'project') return FolderIcon
  return HashtagIcon
}

function entityPrefix(type: string) {
  return type === 'tag' ? '#' : ''
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return entities[char] || char
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlighted(value: string | null | undefined) {
  const safe = escapeHtml(value || '')
  const terms = [
    q.value.trim(),
    ...q.value.trim().split(/\s+/)
  ]
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)

  if (!terms.length) return safe

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return safe.replace(pattern, '<mark class="bg-warning-soft text-text-strong rounded px-0.5">$1</mark>')
}

async function search() {
  searched.value = true
  pending.value = true
  try {
    const query: Record<string, string> = { q: q.value }
    if (kinds.value.size) query.kinds = [...kinds.value].join(',')
    if (lang.value) query.lang = lang.value
    if (dateFrom.value) query.from = dateFrom.value
    if (dateTo.value) query.to = dateTo.value
    const data = await $fetch<{
      results: typeof results.value
      entities: typeof entityHits.value
      mode: 'hybrid' | 'lexical' | 'idle'
    }>('/api/search', { query })
    results.value = data.results
    entityHits.value = data.entities || []
    mode.value = data.mode || 'lexical'
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  const route = useRoute()
  if (typeof route.query.q === 'string') {
    q.value = route.query.q
    void search()
  }
})
</script>

<template>
  <main class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4">
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Retrieve</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">Search knowledge</h1>
      </header>

      <form class="mb-4 flex gap-2" @submit.prevent="search">
        <UiInput
          v-model="q"
          placeholder="What did we discuss about AI training, roadmap, staffing..."
          autofocus
          class="flex-1"
        />
        <UiButton type="submit" :loading="pending" :disabled="!q.trim()">
          {{ pending ? 'Searching…' : 'Search' }}
        </UiButton>
      </form>

      <div class="mb-6 grid gap-3 rounded-card bg-surface-2 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted">Type</span>
          <button
            v-for="kind in SOURCE_TYPES"
            :key="kind"
            type="button"
            :class="[
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
              kinds.has(kind)
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-1 text-text-soft hover:bg-surface-3'
            ]"
            @click="toggleKind(kind)"
          >{{ kind }}</button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="inline-flex items-center gap-2 rounded-full bg-surface-1 px-3 py-1 text-xs text-text-soft">
            <span class="font-semibold">Language</span>
            <select v-model="lang" class="bg-transparent text-xs text-text outline-none">
              <option v-for="opt in LANGS" :key="opt.code" :value="opt.code">{{ opt.label }}</option>
            </select>
          </label>
          <label class="inline-flex items-center gap-2 rounded-full bg-surface-1 px-3 py-1 text-xs text-text-soft">
            <span class="font-semibold">From</span>
            <input v-model="dateFrom" type="date" class="bg-transparent text-xs text-text outline-none">
          </label>
          <label class="inline-flex items-center gap-2 rounded-full bg-surface-1 px-3 py-1 text-xs text-text-soft">
            <span class="font-semibold">To</span>
            <input v-model="dateTo" type="date" class="bg-transparent text-xs text-text outline-none">
          </label>
          <span v-if="searched && mode !== 'idle'" class="ml-auto text-xs text-muted">
            mode: <span class="font-semibold text-text-soft">{{ mode }}</span>
          </span>
        </div>
      </div>

      <section v-if="entityHits.length" class="mb-6">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Entities</p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="entity in entityHits"
            :key="entity.id"
            class="flex items-center gap-2 rounded-card border border-border-subtle bg-surface-1 p-2 transition-colors hover:border-border-strong hover:bg-surface-2"
            :to="routeForEntity(entity.type, entity.id)"
          >
            <span
              class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :style="{ background: colorFor(entity.name).bg, color: colorFor(entity.name).fg }"
            >
              <template v-if="entity.type === 'person'">{{ initialsOf(entity.name) }}</template>
              <component v-else :is="entityIcon(entity.type)" class="size-3.5" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-text">{{ entityPrefix(entity.type) }}{{ entity.name }}</span>
              <small class="text-xs text-muted">{{ entity.type }}</small>
            </span>
          </NuxtLink>
        </div>
      </section>

      <div class="space-y-2">
        <p v-if="results.length" class="text-xs font-semibold uppercase tracking-wider text-muted">Documents</p>
        <NuxtLink
          v-for="result in results"
          :key="result.document_id"
          class="block rounded-card border border-border-subtle p-3 transition-colors hover:border-border-strong hover:bg-surface-2"
          :to="`/documents/${result.document_id}`"
        >
          <div class="mb-1 flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold text-text-strong" v-html="highlighted(result.title)"></h2>
            <small class="shrink-0 text-xs text-muted">{{ result.source_type }} <span v-if="result.captured_at">· {{ formatBrowserDate(result.captured_at) }}</span></small>
          </div>
          <p class="line-clamp-2 text-xs text-text-soft" v-html="highlighted(result.excerpt || result.summary)"></p>
        </NuxtLink>
        <p v-if="searched && !pending && !results.length && !entityHits.length" class="text-sm text-muted">No matches found.</p>
      </div>
    </section>
  </main>
</template>
