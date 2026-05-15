<script setup lang="ts">
import {
  CalendarDaysIcon,
  DocumentTextIcon,
  HashtagIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

interface TagRow {
  id: string
  name: string
  document_count: number
  last_seen: string | null
}

const { data, pending, refresh } = await useFetch<{ tags: TagRow[] }>('/api/tags')
const tags = computed(() => data.value?.tags || [])

const createOpen = ref(false)
function onCreated(entity: { id: string }) {
  return navigateTo(`/tags/${entity.id}`)
}

const multiEdit = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const mergeOpen = ref(false)

function toggleMultiEdit() {
  multiEdit.value = !multiEdit.value
  if (!multiEdit.value) selectedIds.value = new Set()
}
function toggleSelected(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
const selectedCandidates = computed(() => tags.value.filter((t) => selectedIds.value.has(t.id)))
function openMerge() {
  if (selectedCandidates.value.length < 2) return
  mergeOpen.value = true
}
async function onMerged() {
  selectedIds.value = new Set()
  multiEdit.value = false
  await refresh()
}

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}
</script>

<template>
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head entity-index-head">
          <div>
            <p class="eyebrow">Directory</p>
            <h1>Tags</h1>
          </div>
          <div class="entity-index-head-right">
            <button type="button" class="entity-index-select" :class="{ 'is-active': multiEdit }" @click="toggleMultiEdit">
              <Squares2X2Icon class="size-4" aria-hidden="true" />
              <span>{{ multiEdit ? 'Cancel' : 'Select' }}</span>
            </button>
            <button type="button" class="entity-index-add" @click="createOpen = true">
              <PlusIcon class="size-4" aria-hidden="true" />
              <span>Add tag</span>
            </button>
          </div>
        </div>

        <div v-if="multiEdit" class="entity-index-bulkbar">
          <span class="entity-index-bulkbar-count">{{ selectedIds.size }} selected</span>
          <button type="button" class="entity-index-bulkbar-action" :disabled="selectedIds.size < 2" @click="openMerge">Merge</button>
          <button type="button" class="entity-index-bulkbar-close" @click="toggleMultiEdit">
            <XMarkIcon class="size-4" aria-hidden="true" />
          </button>
        </div>

        <EntityCreateDialog v-model:open="createOpen" kind="tag" @created="onCreated" />
        <EntityMergeDialog v-model:open="mergeOpen" kind="tag" :candidates="selectedCandidates" @merged="onMerged" />

        <p v-if="pending" class="muted">Loading…</p>
        <p v-else-if="!tags.length" class="muted">No tags yet.</p>

        <ul v-else class="doc-list entity-index-list" :class="{ 'is-multi-edit': multiEdit }">
          <li
            v-for="t in tags"
            :key="t.id"
            class="doc-list-row entity-index-row"
            :class="{ 'is-selected': selectedIds.has(t.id) }"
          >
            <input
              v-if="multiEdit"
              type="checkbox"
              class="entity-index-checkbox"
              :checked="selectedIds.has(t.id)"
              @change="toggleSelected(t.id)"
            >
            <NuxtLink :to="`/tags/${t.id}`" class="entity-index-link" :class="{ 'is-disabled': multiEdit }">
              <span
                class="avatar entity-tile"
                :style="{ background: colorFor(t.name).bg, color: colorFor(t.name).fg }"
              >
                <HashtagIcon class="size-4" aria-hidden="true" />
              </span>
              <span class="entity-index-name">#{{ t.name }}</span>
            </NuxtLink>
            <div class="entity-index-meta">
              <span v-if="t.document_count" class="entity-index-stat">
                <DocumentTextIcon class="size-3.5" aria-hidden="true" />
                <span>{{ t.document_count }}</span>
              </span>
              <span v-if="t.last_seen" class="entity-index-stat entity-index-stat--muted">
                <CalendarDaysIcon class="size-3.5" aria-hidden="true" />
                <span>{{ formatDate(t.last_seen) }}</span>
              </span>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
