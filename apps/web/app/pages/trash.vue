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
  if (!confirm('Permanently delete this item? This cannot be undone.')) return
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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">System</p>
            <h1>Trash</h1>
          </div>
        </div>

        <p v-if="pending" class="muted">Loading…</p>
        <p v-else-if="!totalCount" class="muted">Trash is empty.</p>

        <template v-else>
          <section v-if="data?.documents.length" class="trash-section">
            <h2 class="trash-section-title">
              <DocumentTextIcon class="size-4" aria-hidden="true" />
              <span>Captures</span>
              <span class="muted">{{ data.documents.length }}</span>
            </h2>
            <ul class="trash-list">
              <li v-for="doc in data.documents" :key="doc.id" class="trash-row">
                <span class="trash-row-title">{{ doc.title }}</span>
                <span class="trash-row-meta">{{ doc.source_type }} · deleted {{ formatDate(doc.deleted_at) }}</span>
                <div class="trash-row-actions">
                  <button type="button" class="trash-btn" @click="restore('documents', doc.id)">
                    <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                    <span>Restore</span>
                  </button>
                  <button type="button" class="trash-btn trash-btn--danger" @click="purge('documents', doc.id)">
                    <TrashIcon class="size-4" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="data?.entities.length" class="trash-section">
            <h2 class="trash-section-title">
              <UsersIcon class="size-4" aria-hidden="true" />
              <span>Entities</span>
              <span class="muted">{{ data.entities.length }}</span>
            </h2>
            <ul class="trash-list">
              <li v-for="ent in data.entities" :key="ent.id" class="trash-row">
                <span class="trash-row-title">
                  <component :is="entityIconFor(ent.type)" class="size-4 text-slate-500" aria-hidden="true" />
                  {{ ent.name }}
                </span>
                <span class="trash-row-meta">{{ ent.type }} · deleted {{ formatDate(ent.deleted_at) }}</span>
                <div class="trash-row-actions">
                  <button type="button" class="trash-btn" @click="restore('entities', ent.id)">
                    <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                    <span>Restore</span>
                  </button>
                  <button type="button" class="trash-btn trash-btn--danger" @click="purge('entities', ent.id)">
                    <TrashIcon class="size-4" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="data?.actions.length" class="trash-section">
            <h2 class="trash-section-title">
              <ClipboardDocumentCheckIcon class="size-4" aria-hidden="true" />
              <span>Actions</span>
              <span class="muted">{{ data.actions.length }}</span>
            </h2>
            <ul class="trash-list">
              <li v-for="act in data.actions" :key="act.id" class="trash-row">
                <span class="trash-row-title">{{ act.title }}</span>
                <span class="trash-row-meta">
                  <span v-if="act.document_title">from {{ act.document_title }} · </span>
                  deleted {{ formatDate(act.deleted_at) }}
                </span>
                <div class="trash-row-actions">
                  <button type="button" class="trash-btn" @click="restore('actions', act.id)">
                    <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                    <span>Restore</span>
                  </button>
                  <button type="button" class="trash-btn trash-btn--danger" @click="purge('actions', act.id)">
                    <TrashIcon class="size-4" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="data?.comments.length" class="trash-section">
            <h2 class="trash-section-title">
              <ChatBubbleLeftIcon class="size-4" aria-hidden="true" />
              <span>Comments</span>
              <span class="muted">{{ data.comments.length }}</span>
            </h2>
            <ul class="trash-list">
              <li v-for="cmt in data.comments" :key="cmt.id" class="trash-row">
                <span class="trash-row-title">{{ cmt.body.slice(0, 140) }}{{ cmt.body.length > 140 ? '…' : '' }}</span>
                <span class="trash-row-meta">
                  <span v-if="cmt.entity_name">on {{ cmt.entity_name }} · </span>
                  deleted {{ formatDate(cmt.deleted_at) }}
                </span>
                <div class="trash-row-actions">
                  <button type="button" class="trash-btn" @click="restore('comments', cmt.id)">
                    <ArrowUturnLeftIcon class="size-4" aria-hidden="true" />
                    <span>Restore</span>
                  </button>
                  <button type="button" class="trash-btn trash-btn--danger" @click="purge('comments', cmt.id)">
                    <TrashIcon class="size-4" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </section>
    </main>
  </div>
</template>
