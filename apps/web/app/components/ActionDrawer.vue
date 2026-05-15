<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import {
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { sourceTypeIcon } from '~/utils/source-type'

interface ActionDetail {
  id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  created_at: string
  updated_at: string
  document_id: string
  document_title: string
  document_source_type: string
  person_id: string | null
  person_name: string | null
  project_id: string | null
  project_name: string | null
  entity_id: string | null
}

interface CommentRow {
  id: string
  entity_id: string
  body: string
  document_id: string | null
  created_at: string
  updated_at: string
}

const actionId = defineModel<string | null>('actionId', { default: null })

const emit = defineEmits<{
  (e: 'updated', action: ActionDetail): void
  (e: 'deleted', actionId: string): void
}>()

const action = ref<ActionDetail | null>(null)
const comments = ref<CommentRow[]>([])
const loading = ref(false)

watch(
  actionId,
  async (id) => {
    if (!id) {
      action.value = null
      comments.value = []
      return
    }
    loading.value = true
    try {
      const data = await $fetch<{ action: ActionDetail, comments: CommentRow[] }>(`/api/actions/${id}`)
      action.value = data.action
      comments.value = data.comments || []
    } catch (error) {
      console.error('Failed to load action', error)
      actionId.value = null
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

function close() {
  actionId.value = null
}

const isOpen = computed(() => !!actionId.value)

const isActionDone = (status: string | null | undefined) => String(status || '').toLowerCase() === 'done'

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const isOverdue = computed(() => {
  const a = action.value
  if (!a?.due_date || isActionDone(a.status) || a.status === 'dismissed') return false
  return String(a.due_date).slice(0, 10) < TODAY_ISO
})
const isToday = computed(() => {
  const a = action.value
  if (!a?.due_date) return false
  return String(a.due_date).slice(0, 10) === TODAY_ISO
})

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}

async function patchAction(body: Record<string, string | null>) {
  if (!action.value) return
  try {
    const result = await $fetch<{ action: any }>(`/api/actions/${action.value.id}`, {
      method: 'PATCH',
      body
    })
    Object.assign(action.value, result.action)
    emit('updated', action.value)
  } catch (error) {
    console.error('Failed to update action', error)
  }
}

async function toggleStatus() {
  if (!action.value) return
  const next = isActionDone(action.value.status) ? 'open' : 'done'
  await patchAction({ status: next })
}

const editingTitle = ref(false)
const draftTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)
function beginEditTitle() {
  if (!action.value) return
  draftTitle.value = action.value.title
  editingTitle.value = true
  void nextTick(() => titleInput.value?.focus())
}
function cancelEditTitle() {
  editingTitle.value = false
  draftTitle.value = ''
}
async function commitEditTitle() {
  if (!action.value) return
  const next = draftTitle.value.trim()
  if (!next || next === action.value.title) {
    cancelEditTitle()
    return
  }
  await patchAction({ title: next })
  cancelEditTitle()
}

const editingDescription = ref(false)
const draftDescription = ref('')
const descriptionInput = ref<HTMLTextAreaElement | null>(null)
function beginEditDescription() {
  if (!action.value) return
  draftDescription.value = action.value.description || ''
  editingDescription.value = true
  void nextTick(() => descriptionInput.value?.focus())
}
function cancelEditDescription() {
  editingDescription.value = false
  draftDescription.value = ''
}
async function commitEditDescription() {
  if (!action.value) return
  const next = draftDescription.value.trim()
  if (next === (action.value.description || '')) {
    cancelEditDescription()
    return
  }
  await patchAction({ description: next || null })
  cancelEditDescription()
}

const dueInput = ref<HTMLInputElement | null>(null)
function openDuePicker() {
  void nextTick(() => {
    const el = dueInput.value
    el?.focus()
    try { (el as unknown as { showPicker?: () => void })?.showPicker?.() } catch {}
  })
}
async function commitDueDate(event: Event) {
  if (!action.value) return
  const value = (event.target as HTMLInputElement).value || null
  if (value === action.value.due_date) return
  await patchAction({ dueDate: value })
}

function selectAssignee(person: { id: string, name: string }) {
  void patchAction({ personId: person.id })
}
function createAssignee(payload: { name: string }) {
  void patchAction({ personName: payload.name })
}
function clearAssignee() {
  void patchAction({ personId: null })
}

const draftCommentBody = ref('')
const postingComment = ref(false)

async function postComment() {
  if (!action.value?.entity_id || postingComment.value) return
  const body = draftCommentBody.value.trim()
  if (!body) return
  postingComment.value = true
  try {
    const result = await $fetch<{ comment: CommentRow }>('/api/comments', {
      method: 'POST',
      body: {
        entityId: action.value.entity_id,
        documentId: action.value.document_id,
        body
      }
    })
    comments.value.push(result.comment)
    draftCommentBody.value = ''
  } catch (error) {
    console.error('Failed to post comment', error)
  } finally {
    postingComment.value = false
  }
}

async function deleteComment(comment: CommentRow) {
  try {
    await $fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    comments.value = comments.value.filter((c) => c.id !== comment.id)
  } catch (error) {
    console.error('Failed to delete comment', error)
  }
}

function handleCommentKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void postComment()
  }
}

async function deleteAction() {
  if (!action.value) return
  const confirmed = window.confirm(`Delete action "${action.value.title}"? This cannot be undone.`)
  if (!confirmed) return
  try {
    await $fetch(`/api/actions/${action.value.id}`, { method: 'DELETE' })
    emit('deleted', action.value.id)
    close()
  } catch (error) {
    console.error('Failed to delete action', error)
  }
}
</script>

<template>
  <TransitionRoot :show="isOpen" as="template" appear>
    <Dialog class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-500/20" />
      </TransitionChild>

      <div class="fixed inset-y-0 right-0 flex max-w-full">
        <TransitionChild
          as="template"
          enter="transform transition ease-out duration-250"
          enter-from="translate-x-full"
          enter-to="translate-x-0"
          leave="transform transition ease-in duration-200"
          leave-from="translate-x-0"
          leave-to="translate-x-full"
        >
          <DialogPanel class="action-drawer">
            <div v-if="action" class="action-drawer-inner">
              <header class="action-drawer-head">
                <div class="action-drawer-head-left">
                  <button
                    type="button"
                    class="doc-action-check"
                    :class="isActionDone(action.status) ? 'is-done' : 'is-open'"
                    @click="toggleStatus"
                  >
                    <CheckCircleIcon class="size-5" aria-hidden="true" />
                  </button>
                  <span class="action-drawer-status-label">{{ isActionDone(action.status) ? 'Completed' : 'Open' }}</span>
                </div>
                <div class="action-drawer-head-right">
                  <button type="button" class="action-drawer-icon-btn" :title="`Delete action`" @click="deleteAction">
                    <TrashIcon class="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" class="action-drawer-icon-btn" title="Close" @click="close">
                    <XMarkIcon class="size-5" aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div class="action-drawer-body">
                <div class="action-drawer-title">
                  <button
                    v-if="!editingTitle"
                    type="button"
                    class="doc-row-edit-trigger action-drawer-title-trigger"
                    @click="beginEditTitle"
                  >
                    <h2 :class="{ 'is-done': isActionDone(action.status) }">{{ action.title }}</h2>
                  </button>
                  <input
                    v-else
                    ref="titleInput"
                    v-model="draftTitle"
                    class="doc-row-edit-input action-drawer-title-input"
                    type="text"
                    maxlength="500"
                    @blur="commitEditTitle"
                    @keydown.enter.prevent="commitEditTitle"
                    @keydown.esc.prevent="cancelEditTitle"
                  >
                </div>

                <dl class="action-drawer-fields">
                  <div class="action-drawer-field">
                    <dt>Assignee</dt>
                    <dd>
                      <AssigneePicker
                        :person-id="action.person_id"
                        :person-name="action.person_name"
                        @select="selectAssignee"
                        @create="createAssignee"
                        @clear="clearAssignee"
                      />
                    </dd>
                  </div>

                  <div class="action-drawer-field">
                    <dt>Due date</dt>
                    <dd class="action-drawer-due">
                      <button
                        type="button"
                        class="doc-action-due-trigger"
                        :class="{
                          'is-overdue': isOverdue,
                          'is-today': isToday,
                          'is-empty': !action.due_date
                        }"
                        @click="openDuePicker"
                      >
                        <CalendarDaysIcon v-if="!action.due_date" class="size-4 asana-due-empty-icon" aria-hidden="true" />
                        <span v-else>{{ isToday ? 'Today' : formatDate(action.due_date) }}</span>
                      </button>
                      <input
                        ref="dueInput"
                        type="date"
                        class="doc-action-due-input"
                        :value="action.due_date || ''"
                        @change="commitDueDate"
                      >
                    </dd>
                  </div>

                  <div v-if="action.project_id" class="action-drawer-field">
                    <dt>Project</dt>
                    <dd>
                      <NuxtLink :to="`/projects/${action.project_id}`" class="entity-link">{{ action.project_name }}</NuxtLink>
                    </dd>
                  </div>

                  <div class="action-drawer-field">
                    <dt>Source</dt>
                    <dd>
                      <NuxtLink :to="`/documents/${action.document_id}`" class="action-drawer-source">
                        <component :is="sourceTypeIcon(action.document_source_type)" class="size-4 text-slate-500" aria-hidden="true" />
                        <span>{{ action.document_title }}</span>
                        <ArrowTopRightOnSquareIcon class="size-3.5 text-slate-400" aria-hidden="true" />
                      </NuxtLink>
                    </dd>
                  </div>
                </dl>

                <section class="action-drawer-section">
                  <h3>
                    <DocumentTextIcon class="size-4 text-slate-500" aria-hidden="true" />
                    <span>Description</span>
                  </h3>
                  <button
                    v-if="!editingDescription"
                    type="button"
                    class="doc-row-edit-trigger entity-description-trigger"
                    @click="beginEditDescription"
                  >
                    <p v-if="action.description" class="entity-description">{{ action.description }}</p>
                    <p v-else class="muted">Add a description for this action…</p>
                  </button>
                  <textarea
                    v-else
                    ref="descriptionInput"
                    v-model="draftDescription"
                    class="doc-comment-textarea"
                    rows="3"
                    placeholder="Add a description…"
                    @blur="commitEditDescription"
                    @keydown.esc.prevent="cancelEditDescription"
                    @keydown.meta.enter.prevent="commitEditDescription"
                    @keydown.ctrl.enter.prevent="commitEditDescription"
                  />
                </section>

                <section class="action-drawer-section">
                  <h3>
                    <ChatBubbleLeftIcon class="size-4 text-slate-500" aria-hidden="true" />
                    <span>Comments</span>
                    <span v-if="comments.length" class="count">{{ comments.length }}</span>
                  </h3>
                  <ul v-if="comments.length" class="doc-comment-list">
                    <li v-for="comment in comments" :key="comment.id" class="doc-comment">
                      <div class="doc-comment-body">{{ comment.body }}</div>
                      <div class="doc-comment-meta">
                        <span>{{ formatDate(comment.created_at) }}</span>
                        <button type="button" class="doc-comment-delete" title="Delete comment" @click="deleteComment(comment)">
                          <TrashIcon class="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  </ul>
                  <div v-if="action.entity_id" class="doc-comment-compose">
                    <textarea
                      v-model="draftCommentBody"
                      class="doc-comment-textarea"
                      rows="2"
                      placeholder="Add a thought about this action…"
                      @keydown="handleCommentKey"
                    />
                    <div class="doc-comment-compose-actions">
                      <span class="doc-comment-hint">Cmd/Ctrl+Enter to post</span>
                      <button
                        type="button"
                        class="doc-comment-post"
                        :disabled="!draftCommentBody.trim() || postingComment"
                        @click="postComment"
                      >
                        {{ postingComment ? 'Posting…' : 'Post' }}
                      </button>
                    </div>
                  </div>
                  <p v-else class="muted">Comments become available after the next processing run.</p>
                </section>
              </div>
            </div>
            <div v-else-if="loading" class="action-drawer-loading">Loading…</div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
