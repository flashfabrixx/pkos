<script setup lang="ts">
import { FolderIcon, HashtagIcon, UsersIcon } from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

const q = ref('')
const searched = ref(false)
const pending = ref(false)
const results = ref<Array<{
  document_id: string
  title: string
  source_type: string
  summary: string | null
  captured_at: string | null
  excerpt: string
}>>([])
const entityHits = ref<Array<{ id: string, type: 'person' | 'project' | 'tag', name: string }>>([])

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
    const data = await $fetch<{ results: typeof results.value, entities: typeof entityHits.value }>('/api/search', {
      query: { q: q.value }
    })
    results.value = data.results
    entityHits.value = data.entities || []
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
