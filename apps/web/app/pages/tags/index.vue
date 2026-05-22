<script setup lang="ts">
import {
  CalendarDaysIcon,
  DocumentTextIcon,
  HashtagIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { colorFor } from '~/utils/hash-color'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('tags.title') })

interface TagRow {
  id: string
  name: string
  document_count: number
  last_seen: string | null
}

const { items: tags, loading, loadingMore, hasMore, reset, sentinelRef } = useInfiniteList<TagRow>({
  pageSize: 50,
  async fetcher({ offset, limit }) {
    const data = await $fetch<{ tags: TagRow[], hasMore: boolean }>('/api/tags', { query: { offset, limit } })
    return { items: data.tags, hasMore: data.hasMore }
  }
})

const createOpen = ref(false)
function onCreated(entity: { id: string }) {
  return navigateTo(`/tags/${entity.id}`)
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
const selectedCandidates = computed(() => tags.value.filter((tag) => selectedIds.value.has(tag.id)))
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
          <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('tags.eyebrow') }}</p>
          <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('tags.title') }}</h1>
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
            {{ t('tags.add') }}
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

      <EntityCreateDialog v-model:open="createOpen" kind="tag" @created="onCreated" />
      <EntityMergeDialog v-model:open="mergeOpen" kind="tag" :candidates="selectedCandidates" @merged="onMerged" />

      <p v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!tags.length" class="text-sm text-muted">{{ t('tags.empty') }}</p>

      <ul v-else class="divide-y divide-border-subtle">
        <li
          v-for="tag in tags"
          :key="tag.id"
          :class="[
            'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 transition-colors',
            selectedIds.has(tag.id) ? 'bg-accent-soft' : 'hover:bg-surface-2'
          ]"
        >
          <input
            v-if="multiEdit"
            type="checkbox"
            class="size-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-accent/20"
            :checked="selectedIds.has(tag.id)"
            @change="toggleSelected(tag.id)"
          >
          <NuxtLink
            :to="`/tags/${tag.id}`"
            :class="[
              'flex min-w-0 items-center gap-3 rounded-md px-2 py-1',
              multiEdit && 'pointer-events-none opacity-80'
            ]"
          >
            <span
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-card"
              :style="{ background: colorFor(tag.name).bg, color: colorFor(tag.name).fg }"
            >
              <HashtagIcon class="size-4" aria-hidden="true" />
            </span>
            <span class="truncate text-sm font-medium text-text-strong">#{{ tag.name }}</span>
          </NuxtLink>
          <div class="flex shrink-0 items-center gap-3 text-xs text-text-soft">
            <span v-if="tag.document_count" class="inline-flex items-center gap-1">
              <DocumentTextIcon class="size-3.5" aria-hidden="true" />
              <span>{{ tag.document_count }}</span>
            </span>
            <span v-if="tag.last_seen" class="inline-flex items-center gap-1 text-muted">
              <CalendarDaysIcon class="size-3.5" aria-hidden="true" />
              <span>{{ formatDate(tag.last_seen) }}</span>
            </span>
          </div>
        </li>
      </ul>

      <div ref="sentinelRef" class="py-4 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">Loading more…</span>
        <span v-else-if="!hasMore && tags.length" class="text-xs text-muted">End of list</span>
      </div>
    </section>
  </main>
</template>
