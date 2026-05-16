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

interface DepartmentRow {
  id: string
  name: string
  parent_id: string | null
  parent_name: string | null
  members_count: number
  projects_count: number
}

const { items: departments, loading, loadingMore, hasMore, reset, sentinelRef } = useInfiniteList<DepartmentRow>({
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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head entity-index-head">
          <div>
            <p class="eyebrow">{{ t('departments.eyebrow') }}</p>
            <h1>{{ t('departments.title') }}</h1>
          </div>
          <div class="entity-index-head-right">
            <button type="button" class="entity-index-add" @click="createOpen = true">
              <PlusIcon class="size-4" aria-hidden="true" />
              <span>{{ t('departments.add') }}</span>
            </button>
          </div>
        </div>

        <EntityCreateDialog v-model:open="createOpen" kind="department" @created="onCreated" />

        <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
        <p v-else-if="!departments.length" class="muted">{{ t('departments.empty') }}</p>

        <ul v-else class="doc-list entity-index-list">
          <li
            v-for="d in departments"
            :key="d.id"
            class="doc-list-row entity-index-row"
          >
            <NuxtLink :to="`/departments/${d.id}`" class="entity-index-link">
              <span class="avatar entity-tile">
                <BuildingOffice2Icon class="size-4" aria-hidden="true" />
              </span>
              <span class="entity-index-name">{{ d.name }}</span>
            </NuxtLink>
            <div class="entity-index-meta">
              <span v-if="d.parent_name" class="entity-index-stat entity-index-stat--muted">
                <BuildingOffice2Icon class="size-3.5" aria-hidden="true" />
                <span>{{ d.parent_name }}</span>
              </span>
              <span v-if="d.members_count" class="entity-index-stat">
                <UsersIcon class="size-3.5" aria-hidden="true" />
                <span>{{ d.members_count }}</span>
              </span>
              <span v-if="d.projects_count" class="entity-index-stat">
                <ClipboardDocumentCheckIcon class="size-3.5" aria-hidden="true" />
                <span>{{ d.projects_count }}</span>
              </span>
            </div>
          </li>
        </ul>

        <div ref="sentinelRef" class="infinite-sentinel" aria-hidden="true">
          <span v-if="loadingMore" class="muted">{{ t('common.load_more') }}</span>
          <span v-else-if="!hasMore && departments.length" class="muted">{{ t('common.end_of_list') }}</span>
        </div>
      </section>
    </main>
  </div>
</template>
