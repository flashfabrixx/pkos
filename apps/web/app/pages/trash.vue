<script setup lang="ts">
import {
  ChatBubbleLeftIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  FolderIcon,
  HashtagIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Mirrors apps/web/server/utils/trash-retention.ts. The server task
// is the authority on actual deletion; this is just the countdown
// label.
const TRASH_RETENTION_DAYS = 30
useHead({ title: () => t('trash.title') })

type TrashKind = 'documents' | 'entities' | 'actions' | 'comments'

interface TrashData {
  documents: Array<{ id: string, title: string, source_type: string, deleted_at: string }>
  entities: Array<{ id: string, type: string, name: string, deleted_at: string }>
  actions: Array<{ id: string, title: string, document_id: string | null, document_title: string | null, deleted_at: string }>
  comments: Array<{ id: string, body: string, entity_id: string | null, entity_name: string | null, entity_type: string | null, deleted_at: string }>
}

const { data, refresh, pending } = await useFetch<TrashData>('/api/trash')

function entityIconFor(type: string | null | undefined): Component {
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

/**
 * Returns the human countdown until trash:purge will hard-delete this
 * row. Pure function of deleted_at + retention window; recomputed on
 * each render so it stays current even on a long-lived page.
 */
function expiresIn(deletedAt: string): { label: string, urgent: boolean } {
  const deleted = new Date(deletedAt).getTime()
  if (Number.isNaN(deleted)) return { label: '', urgent: false }
  const expiresMs = deleted + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const remainingDays = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000))
  if (remainingDays <= 0) return { label: t('trash.expires_today'), urgent: true }
  if (remainingDays === 1) return { label: t('trash.expires_tomorrow'), urgent: true }
  return { label: t('trash.expires_in', { days: remainingDays }), urgent: remainingDays <= 7 }
}

const totalCount = computed(() => {
  if (!data.value) return 0
  return data.value.documents.length + data.value.entities.length + data.value.actions.length + data.value.comments.length
})

interface SectionRow {
  id: string
  icon: Component
  title: string
  meta: string
  deletedAt: string
}
interface Section {
  key: TrashKind
  title: string
  icon: Component
  rows: SectionRow[]
}

const sections = computed<Section[]>(() => {
  if (!data.value) return []
  const out: Section[] = []
  if (data.value.documents.length) {
    out.push({
      key: 'documents',
      title: t('trash.section_captures'),
      icon: DocumentTextIcon,
      rows: data.value.documents.map((doc) => ({
        id: doc.id,
        icon: DocumentTextIcon,
        title: doc.title,
        meta: `${doc.source_type} · ${formatDate(doc.deleted_at)}`,
        deletedAt: doc.deleted_at
      }))
    })
  }
  if (data.value.entities.length) {
    out.push({
      key: 'entities',
      title: t('trash.section_entities'),
      icon: UsersIcon,
      rows: data.value.entities.map((ent) => ({
        id: ent.id,
        icon: entityIconFor(ent.type),
        title: ent.name,
        meta: `${ent.type} · ${formatDate(ent.deleted_at)}`,
        deletedAt: ent.deleted_at
      }))
    })
  }
  if (data.value.actions.length) {
    out.push({
      key: 'actions',
      title: t('trash.section_actions'),
      icon: ClipboardDocumentCheckIcon,
      rows: data.value.actions.map((act) => ({
        id: act.id,
        icon: ClipboardDocumentCheckIcon,
        title: act.title,
        meta: act.document_title ? `${act.document_title} · ${formatDate(act.deleted_at)}` : formatDate(act.deleted_at),
        deletedAt: act.deleted_at
      }))
    })
  }
  if (data.value.comments.length) {
    out.push({
      key: 'comments',
      title: t('trash.section_comments'),
      icon: ChatBubbleLeftIcon,
      rows: data.value.comments.map((cmt) => ({
        id: cmt.id,
        icon: ChatBubbleLeftIcon,
        title: cmt.body.slice(0, 140) + (cmt.body.length > 140 ? '…' : ''),
        meta: cmt.entity_name ? `on ${cmt.entity_name} · ${formatDate(cmt.deleted_at)}` : formatDate(cmt.deleted_at),
        deletedAt: cmt.deleted_at
      }))
    })
  }
  return out
})
</script>

<template>
  <main class="mx-auto w-full max-w-6xl p-5">
    <OverviewHeader :title="t('trash.title')" :subtitle="t('trash.subtitle')" />

    <p v-if="pending" class="text-sm text-muted">{{ t('common.loading') }}</p>
    <p v-else-if="!totalCount" class="text-sm text-muted">{{ t('trash.empty') }}</p>

    <div v-else class="grid gap-6">
      <section
        v-for="section in sections"
        :key="section.key"
        class="overflow-hidden rounded-card border border-border-default bg-surface-1 shadow-card"
      >
        <header class="flex items-center gap-2 border-b border-border-subtle bg-surface-2 px-4 py-2 sm:px-6">
          <component :is="section.icon" class="size-4 text-muted" aria-hidden="true" />
          <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">{{ section.title }}</h2>
          <span class="text-xs text-muted">{{ section.rows.length }}</span>
        </header>
        <table class="min-w-full divide-y divide-border-subtle">
          <tbody class="divide-y divide-border-subtle">
            <tr v-for="row in section.rows" :key="row.id" class="transition-colors hover:bg-surface-2">
              <td class="w-10 py-2 pl-4 pr-2 align-middle sm:pl-6">
                <component :is="row.icon" class="size-4 text-muted" aria-hidden="true" />
              </td>
              <td class="px-2 py-2 align-middle text-sm">
                <p class="truncate font-medium text-text">{{ row.title }}</p>
                <p class="text-xs text-muted">
                  {{ row.meta }}
                  <span
                    :class="['ml-1', expiresIn(row.deletedAt).urgent ? 'text-warning' : 'text-muted-soft']"
                  >· {{ expiresIn(row.deletedAt).label }}</span>
                </p>
              </td>
              <td class="whitespace-nowrap py-2 pl-3 pr-4 text-right align-middle text-sm sm:pr-6">
                <button
                  type="button"
                  class="font-medium text-accent hover:text-accent-strong"
                  @click="restore(section.key, row.id)"
                >{{ t('trash.restore') }}</button>
                <span class="mx-2 text-muted-soft">·</span>
                <button
                  type="button"
                  class="font-medium text-danger hover:text-danger"
                  @click="purge(section.key, row.id)"
                >{{ t('trash.purge') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>
