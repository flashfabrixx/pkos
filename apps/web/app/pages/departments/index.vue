<script setup lang="ts">
import {
  BuildingOffice2Icon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
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
</script>

<template>
  <main class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('departments.eyebrow') }}</p>
          <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('departments.title') }}</h1>
        </div>
        <UiButton size="sm" @click="createOpen = true">
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ t('departments.add') }}
        </UiButton>
      </header>

      <EntityCreateDialog v-model:open="createOpen" kind="department" @created="onCreated" />

      <p v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!departments.length" class="text-sm text-muted">{{ t('departments.empty') }}</p>

      <ul v-else class="divide-y divide-border-subtle">
        <li
          v-for="d in departments"
          :key="d.id"
          class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 transition-colors hover:bg-surface-2"
        >
          <span></span>
          <NuxtLink :to="`/departments/${d.id}`" class="flex min-w-0 items-center gap-3 rounded-md px-2 py-1">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-card bg-soft text-text-soft">
              <BuildingOffice2Icon class="size-4" aria-hidden="true" />
            </span>
            <span class="truncate text-sm font-medium text-text-strong">{{ d.name }}</span>
          </NuxtLink>
          <div class="flex shrink-0 items-center gap-3 text-xs text-text-soft">
            <span v-if="d.parent_name" class="inline-flex items-center gap-1 text-muted">
              <BuildingOffice2Icon class="size-3.5" aria-hidden="true" />
              <span>{{ d.parent_name }}</span>
            </span>
            <span v-if="d.members_count" class="inline-flex items-center gap-1">
              <UsersIcon class="size-3.5" aria-hidden="true" />
              <span>{{ d.members_count }}</span>
            </span>
            <span v-if="d.projects_count" class="inline-flex items-center gap-1">
              <ClipboardDocumentCheckIcon class="size-3.5" aria-hidden="true" />
              <span>{{ d.projects_count }}</span>
            </span>
          </div>
        </li>
      </ul>

      <div ref="sentinelRef" class="py-4 text-center" aria-hidden="true">
        <span v-if="loadingMore" class="text-xs text-muted">{{ t('common.load_more') }}</span>
        <span v-else-if="!hasMore && departments.length" class="text-xs text-muted">{{ t('common.end_of_list') }}</span>
      </div>
    </section>
  </main>
</template>
