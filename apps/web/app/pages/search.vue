<script setup lang="ts">
import { FolderIcon, HashtagIcon, UsersIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { colorFor } from '~/utils/hash-color'

const { t } = useI18n()
useHead({ title: () => t('search.title') })

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
  return safe.replace(pattern, '<mark>$1</mark>')
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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Retrieve</p>
            <h1>Search knowledge</h1>
          </div>
        </div>

        <form class="search-bar" @submit.prevent="search">
          <input v-model="q" placeholder="What did we discuss about AI training, roadmap, staffing..." autofocus>
          <button type="submit" :disabled="pending || !q.trim()">
            {{ pending ? 'Searching...' : 'Search' }}
          </button>
        </form>

        <div class="search-facets">
          <div class="search-facet-row">
            <span class="search-facet-label">Type</span>
            <button
              v-for="kind in SOURCE_TYPES"
              :key="kind"
              type="button"
              class="search-facet-chip"
              :class="{ 'is-active': kinds.has(kind) }"
              @click="toggleKind(kind)"
            >{{ kind }}</button>
          </div>
          <div class="search-facet-row">
            <label class="search-facet-pill">
              <span>Language</span>
              <select v-model="lang">
                <option v-for="opt in LANGS" :key="opt.code" :value="opt.code">{{ opt.label }}</option>
              </select>
            </label>
            <label class="search-facet-pill">
              <span>From</span>
              <input v-model="dateFrom" type="date">
            </label>
            <label class="search-facet-pill">
              <span>To</span>
              <input v-model="dateTo" type="date">
            </label>
            <span v-if="searched && mode !== 'idle'" class="search-facet-mode">
              mode: {{ mode }}
            </span>
          </div>
        </div>

        <section v-if="entityHits.length" class="search-entity-zone">
          <p class="search-entity-eyebrow">Entities</p>
          <div class="search-entity-grid">
            <NuxtLink
              v-for="entity in entityHits"
              :key="entity.id"
              class="search-entity-card"
              :to="routeForEntity(entity.type, entity.id)"
            >
              <span
                v-if="entity.type === 'person'"
                class="avatar"
                :style="{ background: colorFor(entity.name).bg, color: colorFor(entity.name).fg }"
              >{{ initialsOf(entity.name) }}</span>
              <span
                v-else
                class="avatar"
                :style="{ background: colorFor(entity.name).bg, color: colorFor(entity.name).fg }"
              >
                <component :is="entityIcon(entity.type)" class="size-3.5" aria-hidden="true" />
              </span>
              <span class="search-entity-text">
                <span class="search-entity-name">{{ entityPrefix(entity.type) }}{{ entity.name }}</span>
                <small>{{ entity.type }}</small>
              </span>
            </NuxtLink>
          </div>
        </section>

        <div class="results">
          <p v-if="results.length" class="search-section-eyebrow">Documents</p>
          <NuxtLink v-for="result in results" :key="result.document_id" class="result" :to="`/documents/${result.document_id}`">
            <div>
              <h2 v-html="highlighted(result.title)"></h2>
              <small>{{ result.source_type }} <span v-if="result.captured_at">· {{ formatBrowserDate(result.captured_at) }}</span></small>
            </div>
            <p v-html="highlighted(result.excerpt || result.summary)"></p>
          </NuxtLink>
          <p v-if="searched && !pending && !results.length && !entityHits.length" class="muted">No matches found.</p>
        </div>
      </section>
    </main>
  </div>
</template>
