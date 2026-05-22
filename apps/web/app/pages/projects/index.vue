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
import { useI18n } from 'vue-i18n'
import { colorFor } from '~/utils/hash-color'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('projects.title') })

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

const route = useRoute()
onMounted(() => {
  if (route.query.new === '1') createOpen.value = true
})

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
  <main class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('projects.eyebrow') }}</p>
          <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('projects.title') }}</h1>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UiButton
            :variant="multiEdit ? 'primary' : 'secondary'"
            size="sm"
            @click="toggleMultiEdit"
          >
            <Squares2X2Icon class="size-4" aria-hidden="true" />
            {{ multiEdit ? 'Cancel' : 'Select' }}
          </UiButton>
          <UiButton size="sm" @click="createOpen = true">
            <PlusIcon class="size-4" aria-hidden="true" />
            {{ t('projects.add') }}
          </UiButton>
        </div>
      </header>

      <div
        v-if="multiEdit"
        class="mb-4 flex items-center gap-2 rounded-card border border-border-default bg-surface-2 px-3 py-2"
      >
        <span class="text-sm font-semibold text-text">{{ selectedIds.size }} selected</span>
        <UiButton variant="secondary" size="sm" :disabled="selectedIds.size < 2" @click="openMerge">Merge</UiButton>
        <button
          type="button"
          class="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-soft hover:bg-surface-3 hover:text-text"
          :aria-label="t('common.close')"
          @click="toggleMultiEdit"
        >
          <XMarkIcon class="size-4" aria-hidden="true" />
        </button>
      </div>

      <EntityCreateDialog v-model:open="createOpen" kind="project" @created="onCreated" />
      <EntityMergeDialog v-model:open="mergeOpen" kind="project" :candidates="selectedCandidates" @merged="onMerged" />

      <p v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!projects.length" class="text-sm text-muted">{{ t('projects.empty') }}</p>

      <ul v-else class="divide-y divide-border-subtle">
        <li
          v-for="p in projects"
          :key="p.id"
          :class="[
            'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 transition-colors',
            selectedIds.has(p.id) ? 'bg-accent-soft' : 'hover:bg-surface-2'
          ]"
        >
          <input
            v-if="multiEdit"
            type="checkbox"
            class="size-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-accent/20"
            :checked="selectedIds.has(p.id)"
            @change="toggleSelected(p.id)"
          >
          <NuxtLink
            :to="`/projects/${p.id}`"
            :class="[
              'flex min-w-0 items-center gap-3 rounded-md px-2 py-1',
              multiEdit && 'pointer-events-none opacity-80'
            ]"
          >
            <span
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-card"
              :style="{ background: colorFor(p.name).bg, color: colorFor(p.name).fg }"
            >
              <FolderIcon class="size-4" aria-hidden="true" />
            </span>
            <span class="truncate text-sm font-medium text-text-strong">{{ p.name }}</span>
          </NuxtLink>
          <div class="flex shrink-0 items-center gap-3 text-xs text-text-soft">
            <span v-if="p.document_count" class="inline-flex items-center gap-1">
              <DocumentTextIcon class="size-3.5" aria-hidden="true" />
              <span>{{ p.document_count }}</span>
            </span>
            <span v-if="p.actions_open || p.actions_done" class="inline-flex items-center gap-1">
              <ClipboardDocumentCheckIcon class="size-3.5" aria-hidden="true" />
              <span>{{ p.actions_open }} open</span>
            </span>
            <span v-if="p.last_seen" class="inline-flex items-center gap-1 text-muted">
              <CalendarDaysIcon class="size-3.5" aria-hidden="true" />
              <span>{{ formatDate(p.last_seen) }}</span>
            </span>
          </div>
        </li>
      </ul>

      <div ref="sentinelRef" class="py-4 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">Loading more…</span>
        <span v-else-if="!hasMore && projects.length" class="text-xs text-muted">End of list</span>
      </div>
    </section>
  </main>
</template>
