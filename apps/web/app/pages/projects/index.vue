<script setup lang="ts">
import {
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  FolderIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'
import { useInfiniteList } from '~/composables/useInfiniteList'

interface ProjectRow {
  id: string
  name: string
  document_count: number
  actions_open: number
  actions_done: number
  last_seen: string | null
}

const { items: projects, loading, loadingMore, hasMore, reset, sentinelRef } = useInfiniteList<ProjectRow>({
  pageSize: 50,
  async fetcher({ offset, limit }) {
    const data = await $fetch<{ projects: ProjectRow[], hasMore: boolean }>('/api/projects', { query: { offset, limit } })
    return { items: data.projects, hasMore: data.hasMore }
  }
})

const createOpen = ref(false)
function onCreated(entity: { id: string }) {
  return navigateTo(`/projects/${entity.id}`)
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
const selectedCandidates = computed(() => projects.value.filter((p) => selectedIds.value.has(p.id)))
function openMerge() {
  if (selectedCandidates.value.length < 2) return
  mergeOpen.value = true
}
async function onMerged() {
  selectedIds.value = new Set()
  multiEdit.value = false
  await reset()
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
            <h1>Projects</h1>
          </div>
          <div class="entity-index-head-right">
            <button type="button" class="entity-index-select" :class="{ 'is-active': multiEdit }" @click="toggleMultiEdit">
              <Squares2X2Icon class="size-4" aria-hidden="true" />
              <span>{{ multiEdit ? 'Cancel' : 'Select' }}</span>
            </button>
            <button type="button" class="entity-index-add" @click="createOpen = true">
              <PlusIcon class="size-4" aria-hidden="true" />
              <span>Add project</span>
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

        <EntityCreateDialog v-model:open="createOpen" kind="project" @created="onCreated" />
        <EntityMergeDialog v-model:open="mergeOpen" kind="project" :candidates="selectedCandidates" @merged="onMerged" />

        <p v-if="loading" class="muted">Loading…</p>
        <p v-else-if="!projects.length" class="muted">No projects yet.</p>

        <ul v-else class="doc-list entity-index-list" :class="{ 'is-multi-edit': multiEdit }">
          <li
            v-for="p in projects"
            :key="p.id"
            class="doc-list-row entity-index-row"
            :class="{ 'is-selected': selectedIds.has(p.id) }"
          >
            <input
              v-if="multiEdit"
              type="checkbox"
              class="entity-index-checkbox"
              :checked="selectedIds.has(p.id)"
              @change="toggleSelected(p.id)"
            >
            <NuxtLink :to="`/projects/${p.id}`" class="entity-index-link" :class="{ 'is-disabled': multiEdit }">
              <span
                class="avatar entity-tile"
                :style="{ background: colorFor(p.name).bg, color: colorFor(p.name).fg }"
              >
                <FolderIcon class="size-4" aria-hidden="true" />
              </span>
              <span class="entity-index-name">{{ p.name }}</span>
            </NuxtLink>
            <div class="entity-index-meta">
              <span v-if="p.document_count" class="entity-index-stat">
                <DocumentTextIcon class="size-3.5" aria-hidden="true" />
                <span>{{ p.document_count }}</span>
              </span>
              <span v-if="p.actions_open || p.actions_done" class="entity-index-stat">
                <ClipboardDocumentCheckIcon class="size-3.5" aria-hidden="true" />
                <span>{{ p.actions_open }} open</span>
              </span>
              <span v-if="p.last_seen" class="entity-index-stat entity-index-stat--muted">
                <CalendarDaysIcon class="size-3.5" aria-hidden="true" />
                <span>{{ formatDate(p.last_seen) }}</span>
              </span>
            </div>
          </li>
        </ul>

        <div ref="sentinelRef" class="infinite-sentinel" aria-hidden="true">
          <span v-if="loadingMore" class="muted">Loading more…</span>
          <span v-else-if="!hasMore && projects.length" class="muted">End of list</span>
        </div>
      </section>
    </main>
  </div>
</template>
