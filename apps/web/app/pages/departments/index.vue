<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('departments.title') })

interface DepartmentRow {
  id: string
  name: string
  parent_id: string | null
  parent_name: string | null
  members_count: number
  projects_count: number
}

const { items: departments, loading, loadingMore, hasMore, sentinelRef } = useInfiniteList<DepartmentRow>({
  pageSize: 50,
  async fetcher({ offset, limit }) {
    const data = await $fetch<{ departments: DepartmentRow[], hasMore: boolean }>('/api/departments', {
      query: { offset, limit }
    })
    return { items: data.departments, hasMore: data.hasMore }
  }
})

const createOpen = ref(false)
function onCreated(entity: { id: string }) {
  return navigateTo(`/departments/${entity.id}`)
}

const route = useRoute()
onMounted(() => {
  if (route.query.new === '1') createOpen.value = true
})
</script>

<template>
  <main class="mx-auto w-full max-w-6xl p-5">
    <OverviewHeader
      :eyebrow="t('departments.eyebrow')"
      :title="t('departments.title')"
      :subtitle="t('departments.subtitle')"
    >
      <template #actions>
        <UiButton size="sm" @click="createOpen = true">
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ t('departments.add') }}
        </UiButton>
      </template>
    </OverviewHeader>

    <EntityCreateDialog v-model:open="createOpen" kind="department" @created="onCreated" />

    <div class="overflow-hidden rounded-card border border-border-default bg-surface-1 shadow-card">
      <p v-if="loading" class="p-5 text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!departments.length" class="p-5 text-sm text-muted">{{ t('departments.empty') }}</p>
      <table v-else class="min-w-full divide-y divide-border-subtle">
        <thead class="bg-surface-2">
          <tr>
            <th scope="col" class="py-2 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-muted sm:pl-6">{{ t('common.name') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('departments.parent') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('departments.members_title') }}</th>
            <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">{{ t('departments.projects_title') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle">
          <tr v-for="d in departments" :key="d.id" class="transition-colors hover:bg-surface-2">
            <td class="py-2 pl-4 pr-3 text-sm sm:pl-6">
              <NuxtLink :to="`/departments/${d.id}`" class="font-medium text-text hover:text-accent">{{ d.name }}</NuxtLink>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-sm text-text-soft">
              <NuxtLink v-if="d.parent_id && d.parent_name" :to="`/departments/${d.parent_id}`" class="hover:text-accent">{{ d.parent_name }}</NuxtLink>
              <span v-else>—</span>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ d.members_count || '—' }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-text-soft">{{ d.projects_count || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div ref="sentinelRef" class="border-t border-border-subtle py-3 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">{{ t('common.load_more') }}</span>
        <span v-else-if="!hasMore && departments.length" class="text-xs text-muted">{{ t('common.end_of_list') }}</span>
      </div>
    </div>
  </main>
</template>
