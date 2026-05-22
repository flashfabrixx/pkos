<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('people.title') })

interface PersonRow {
  id: string
  name: string
  document_count: number
  actions_open: number
  actions_done: number
  last_seen: string | null
}

const { items: people, loading, loadingMore, hasMore, reset, sentinelRef } = useInfiniteList<PersonRow>({
  pageSize: 50,
  async fetcher({ offset, limit }) {
    const data = await $fetch<{ people: PersonRow[], hasMore: boolean }>('/api/people', { query: { offset, limit } })
    return { items: data.people, hasMore: data.hasMore }
  }
})

const createOpen = ref(false)
function onCreated(entity: { id: string }) {
  return navigateTo(`/people/${entity.id}`)
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
  people.value.length > 0 && people.value.every((p) => selectedIds.value.has(p.id))
)
const indeterminate = computed(() => selectedIds.value.size > 0 && !allSelected.value)
function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(people.value.map((p) => p.id))
  }
}

const selectedCandidates = computed(() =>
  people.value.filter((p) => selectedIds.value.has(p.id))
)
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
      :title="t('people.title')"
      :subtitle="t('people.subtitle')"
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
          {{ t('people.add') }}
        </UiButton>
      </template>
    </OverviewHeader>

    <EntityCreateDialog v-model:open="createOpen" kind="person" @created="onCreated" />
    <EntityMergeDialog
      v-model:open="mergeOpen"
      kind="person"
      :candidates="selectedCandidates"
      @merged="onMerged"
    />

    <div class="overflow-hidden rounded-card border border-border-default bg-surface-1 shadow-card">
      <p v-if="loading" class="p-5 text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!people.length" class="p-5 text-sm text-muted">{{ t('people.empty') }}</p>
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
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('common.name') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('captures.title') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('common.open') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('common.done') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('people.last_seen') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr
            v-for="p in people"
            :key="p.id"
            :class="[selectedIds.has(p.id) ? 'bg-accent-soft' : 'hover:bg-surface-2', 'transition-colors']"
          >
            <td class="py-2 pl-4 pr-3 align-middle sm:pl-6">
              <UiCheckbox
                :model-value="selectedIds.has(p.id)"
                :aria-label="`Select ${p.name}`"
                @change="toggleSelected(p.id)"
              />
            </td>
            <td class="px-3 py-2 text-sm">
              <NuxtLink :to="`/people/${p.id}`" class="font-medium text-text hover:text-accent">{{ p.name }}</NuxtLink>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ p.document_count || '—' }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ p.actions_open || '—' }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-muted">{{ p.actions_done || '—' }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-muted">{{ p.last_seen ? formatDate(p.last_seen) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div ref="sentinelRef" class="py-2 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">{{ t('common.loading') }}</span>
      </div>
    </div>
  </main>
</template>
