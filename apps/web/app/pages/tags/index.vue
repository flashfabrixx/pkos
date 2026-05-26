<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
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

const selectedIds = ref<Set<string>>(new Set())
const mergeOpen = ref(false)

function toggleSelected(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const allSelected = computed(() =>
  tags.value.length > 0 && tags.value.every((t) => selectedIds.value.has(t.id))
)
const indeterminate = computed(() => selectedIds.value.size > 0 && !allSelected.value)
function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(tags.value.map((t) => t.id))
  }
}

const selectedCandidates = computed(() => tags.value.filter((tag) => selectedIds.value.has(tag.id)))
function openMerge() {
  if (selectedCandidates.value.length < 2) return
  mergeOpen.value = true
}
async function onMerged() {
  selectedIds.value = new Set()
  await reset()
}

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}
</script>

<template>
  <main class="mx-auto w-full max-w-6xl p-5">
    <OverviewHeader
      :title="t('tags.title')"
      :subtitle="t('tags.subtitle')"
    >
      <template #actions>
        <UiButton
          v-if="selectedCandidates.length >= 2"
          variant="secondary"
          size="sm"
          @click="openMerge"
        >{{ t('people.merge') }} ({{ selectedCandidates.length }})</UiButton>
        <UiButton size="sm" @click="createOpen = true">
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ t('tags.add') }}
        </UiButton>
      </template>
    </OverviewHeader>

    <EntityCreateDialog v-model:open="createOpen" kind="tag" @created="onCreated" />
    <EntityMergeDialog v-model:open="mergeOpen" kind="tag" :candidates="selectedCandidates" @merged="onMerged" />

    <div class="overflow-hidden rounded-card border border-border-default bg-surface-1 shadow-card">
      <p v-if="loading" class="p-5 text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!tags.length" class="p-5 text-sm text-muted">{{ t('tags.empty') }}</p>
      <table v-else class="min-w-full divide-y divide-border-subtle">
        <thead class="bg-surface-2">
          <tr>
            <th scope="col" class="w-10 py-2 pl-4 pr-3 align-middle sm:pl-6">
              <UiCheckbox
                :model-value="allSelected"
                :indeterminate="indeterminate"
                :aria-label="t('common.select_all')"
                @change="toggleAll"
              />
            </th>
            <th scope="col" class="w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('common.name') }}</th>
            <th scope="col" class="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('tags.usage') }}</th>
            <th scope="col" class="whitespace-nowrap px-3 py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted sm:pr-6">{{ t('tags.last_used') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr
            v-for="tag in tags"
            :key="tag.id"
            :class="[selectedIds.has(tag.id) ? 'bg-accent-soft' : 'hover:bg-surface-2', 'transition-colors']"
          >
            <td class="py-2 pl-4 pr-3 align-middle sm:pl-6">
              <UiCheckbox
                :model-value="selectedIds.has(tag.id)"
                :aria-label="`Select ${tag.name}`"
                @change="toggleSelected(tag.id)"
              />
            </td>
            <td class="px-3 py-2 text-sm">
              <NuxtLink :to="`/tags/${tag.id}`" class="font-medium text-text hover:text-accent">#{{ tag.name }}</NuxtLink>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ tag.document_count || '—' }}</td>
            <td class="whitespace-nowrap px-3 py-2 pr-4 text-sm tabular-nums text-muted sm:pr-6">{{ tag.last_seen ? formatDate(tag.last_seen) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div ref="sentinelRef" :class="loadingMore ? 'py-2 text-center' : ''" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">{{ t('common.loading') }}</span>
      </div>
    </div>
  </main>
</template>
