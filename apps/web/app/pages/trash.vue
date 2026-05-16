<script setup lang="ts">
import {
  ArrowUturnLeftIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  HashtagIcon,
  TrashIcon,
  UsersIcon,
  FolderIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('trash.title') })

type TrashKind = 'documents' | 'entities' | 'actions' | 'comments'

interface TrashData {
  documents: Array<{ id: string, title: string, source_type: string, deleted_at: string }>
  entities: Array<{ id: string, type: string, name: string, deleted_at: string }>
  actions: Array<{ id: string, title: string, document_id: string | null, document_title: string | null, deleted_at: string }>
  comments: Array<{ id: string, body: string, entity_id: string | null, entity_name: string | null, entity_type: string | null, deleted_at: string }>
}

const { data, refresh, pending } = await useFetch<TrashData>('/api/trash')

function entityIconFor(type: string | null | undefined) {
  if (type === 'person') return UsersIcon
  if (type === 'project') return FolderIcon
  if (type === 'tag') return HashtagIcon
  return DocumentTextIcon
}

async function restore(kind: TrashKind, id: string) {
  try {
    await $fetch('/api/trash/restore', { method: 'POST', body: { kind, id } })
    await refresh()
  } catch (error) {
    console.error('Failed to restore', error)
  }
}

async function purge(kind: TrashKind, id: string) {
  if (!confirm(t('trash.confirm_purge'))) return
  try {
    await $fetch('/api/trash/purge', { method: 'POST', body: { kind, id } })
    await refresh()
  } catch (error) {
    console.error('Failed to purge', error)
  }
}

function formatDate(value: string | null | undefined) {
  return formatBrowserDate(value)
}

const totalCount = computed(() => {
  if (!data.value) return 0
  return data.value.documents.length + data.value.entities.length + data.value.actions.length + data.value.comments.length
})
</script>

<template>
  <main class="mx-auto grid max-w-5xl gap-4 p-5">
    <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="mb-4">
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('trash.eyebrow') }}</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('trash.title') }}</h1>
      </header>

      <p v-if="pending" class="text-sm text-muted">{{ t('common.loading') }}</p>
      <p v-else-if="!totalCount" class="text-sm text-muted">{{ t('trash.empty') }}</p>

      <div v-else class="grid gap-6">
        <section v-if="data?.documents.length">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-text-strong">
            <DocumentTextIcon class="size-4" aria-hidden="true" />
            <span>{{ t('trash.section_captures') }}</span>
            <span class="text-xs font-normal text-muted">{{ data.documents.length }}</span>
          </h2>
          <ul class="divide-y divide-border-subtle">
            <li v-for="doc in data.documents" :key="doc.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">{{ doc.title }}</p>
                <p class="text-xs text-muted">{{ doc.source_type }} · deleted {{ formatDate(doc.deleted_at) }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UiButton variant="secondary" size="sm" @click="restore('documents', doc.id)">
                  <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.restore') }}
                </UiButton>
                <UiButton variant="danger" size="sm" @click="purge('documents', doc.id)">
                  <TrashIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.purge') }}
                </UiButton>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="data?.entities.length">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-text-strong">
            <UsersIcon class="size-4" aria-hidden="true" />
            <span>{{ t('trash.section_entities') }}</span>
            <span class="text-xs font-normal text-muted">{{ data.entities.length }}</span>
          </h2>
          <ul class="divide-y divide-border-subtle">
            <li v-for="ent in data.entities" :key="ent.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 truncate text-sm font-medium text-text">
                  <component :is="entityIconFor(ent.type)" class="size-4 text-muted" aria-hidden="true" />
                  {{ ent.name }}
                </p>
                <p class="text-xs text-muted">{{ ent.type }} · deleted {{ formatDate(ent.deleted_at) }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UiButton variant="secondary" size="sm" @click="restore('entities', ent.id)">
                  <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.restore') }}
                </UiButton>
                <UiButton variant="danger" size="sm" @click="purge('entities', ent.id)">
                  <TrashIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.purge') }}
                </UiButton>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="data?.actions.length">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-text-strong">
            <ClipboardDocumentCheckIcon class="size-4" aria-hidden="true" />
            <span>{{ t('trash.section_actions') }}</span>
            <span class="text-xs font-normal text-muted">{{ data.actions.length }}</span>
          </h2>
          <ul class="divide-y divide-border-subtle">
            <li v-for="act in data.actions" :key="act.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">{{ act.title }}</p>
                <p class="text-xs text-muted">
                  <span v-if="act.document_title">from {{ act.document_title }} · </span>
                  deleted {{ formatDate(act.deleted_at) }}
                </p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UiButton variant="secondary" size="sm" @click="restore('actions', act.id)">
                  <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.restore') }}
                </UiButton>
                <UiButton variant="danger" size="sm" @click="purge('actions', act.id)">
                  <TrashIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.purge') }}
                </UiButton>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="data?.comments.length">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-text-strong">
            <ChatBubbleLeftIcon class="size-4" aria-hidden="true" />
            <span>{{ t('trash.section_comments') }}</span>
            <span class="text-xs font-normal text-muted">{{ data.comments.length }}</span>
          </h2>
          <ul class="divide-y divide-border-subtle">
            <li v-for="cmt in data.comments" :key="cmt.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-text">{{ cmt.body.slice(0, 140) }}{{ cmt.body.length > 140 ? '…' : '' }}</p>
                <p class="text-xs text-muted">
                  <span v-if="cmt.entity_name">on {{ cmt.entity_name }} · </span>
                  deleted {{ formatDate(cmt.deleted_at) }}
                </p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UiButton variant="secondary" size="sm" @click="restore('comments', cmt.id)">
                  <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.restore') }}
                </UiButton>
                <UiButton variant="danger" size="sm" @click="purge('comments', cmt.id)">
                  <TrashIcon class="size-4" aria-hidden="true" />
                  {{ t('trash.purge') }}
                </UiButton>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </section>
  </main>
</template>
