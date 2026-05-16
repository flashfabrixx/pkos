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
        <div class="fixed inset-0 bg-overlay backdrop-blur-sm" />
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
          <DialogPanel class="flex h-screen w-screen flex-col bg-surface-1 shadow-popover sm:w-[440px]">
            <div v-if="action" class="flex h-full flex-col">
              <header class="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    :class="[
                      'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                      isActionDone(action.status)
                        ? 'text-success hover:bg-success-soft'
                        : 'text-muted-soft hover:bg-success-soft hover:text-success'
                    ]"
                    @click="toggleStatus"
                  >
                    <CheckCircleIcon class="size-5" aria-hidden="true" />
                  </button>
                  <span class="text-xs font-semibold uppercase tracking-wider text-muted">{{ isActionDone(action.status) ? 'Completed' : 'Open' }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-muted-soft hover:bg-danger-soft hover:text-danger"
                    title="Delete action"
                    @click="deleteAction"
                  >
                    <TrashIcon class="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-muted-soft hover:bg-surface-3 hover:text-text"
                    title="Close"
                    @click="close"
                  >
                    <XMarkIcon class="size-5" aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div class="flex-1 space-y-6 overflow-y-auto px-4 py-5">
                <div>
                  <button
                    v-if="!editingTitle"
                    type="button"
                    class="-mx-2 block w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-3"
                    @click="beginEditTitle"
                  >
                    <h2
                      class="text-lg font-semibold text-text-strong"
                      :class="isActionDone(action.status) && 'text-muted line-through'"
                    >{{ action.title }}</h2>
                  </button>
                  <input
                    v-else
                    ref="titleInput"
                    v-model="draftTitle"
                    class="block w-full rounded-md border border-accent bg-surface-1 px-2 py-1 text-lg font-semibold text-text-strong outline-none focus:ring-2 focus:ring-accent/20"
                    type="text"
                    maxlength="500"
                    @blur="commitEditTitle"
                    @keydown.enter.prevent="commitEditTitle"
                    @keydown.esc.prevent="cancelEditTitle"
                  >
                </div>

                <dl class="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-y-3 text-sm">
                  <dt class="text-xs font-semibold uppercase tracking-wider text-muted">Assignee</dt>
                  <dd>
                    <AssigneePicker
                      :person-id="action.person_id"
                      :person-name="action.person_name"
                      @select="selectAssignee"
                      @create="createAssignee"
                      @clear="clearAssignee"
                    />
                  </dd>

                  <dt class="text-xs font-semibold uppercase tracking-wider text-muted">Due date</dt>
                  <dd class="relative">
                    <button
                      type="button"
                      :class="[
                        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-surface-3',
                        isOverdue && 'text-danger',
                        isToday && !isOverdue && 'text-warning',
                        !action.due_date && 'text-muted-soft'
                      ]"
                      @click="openDuePicker"
                    >
                      <CalendarDaysIcon v-if="!action.due_date" class="size-4" aria-hidden="true" />
                      <span v-else>{{ isToday ? 'Today' : formatDate(action.due_date) }}</span>
                    </button>
                    <input
                      ref="dueInput"
                      type="date"
                      class="pointer-events-none absolute inset-0 opacity-0"
                      :value="action.due_date || ''"
                      @change="commitDueDate"
                    >
                  </dd>

                  <template v-if="action.project_id">
                    <dt class="text-xs font-semibold uppercase tracking-wider text-muted">Project</dt>
                    <dd>
                      <NuxtLink :to="`/projects/${action.project_id}`" class="text-sm text-accent hover:underline">{{ action.project_name }}</NuxtLink>
                    </dd>
                  </template>

                  <dt class="text-xs font-semibold uppercase tracking-wider text-muted">Source</dt>
                  <dd>
                    <NuxtLink
                      :to="`/documents/${action.document_id}`"
                      class="inline-flex items-center gap-1.5 text-sm text-text hover:text-accent"
                    >
                      <component :is="sourceTypeIcon(action.document_source_type)" class="size-4 text-muted" aria-hidden="true" />
                      <span class="truncate">{{ action.document_title }}</span>
                      <ArrowTopRightOnSquareIcon class="size-3.5 text-muted-soft" aria-hidden="true" />
                    </NuxtLink>
                  </dd>
                </dl>

                <section class="space-y-2">
                  <h3 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
                    <DocumentTextIcon class="size-4 text-muted" aria-hidden="true" />
                    <span>Description</span>
                  </h3>
                  <button
                    v-if="!editingDescription"
                    type="button"
                    class="-mx-2 block w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-3"
                    @click="beginEditDescription"
                  >
                    <p v-if="action.description" class="whitespace-pre-wrap text-sm leading-relaxed text-text">{{ action.description }}</p>
                    <p v-else class="text-sm text-muted">Add a description for this action…</p>
                  </button>
                  <UiTextarea
                    v-else
                    ref="descriptionInput"
                    v-model="draftDescription"
                    :rows="3"
                    placeholder="Add a description…"
                    @blur="commitEditDescription"
                    @keydown.esc.prevent="cancelEditDescription"
                    @keydown.meta.enter.prevent="commitEditDescription"
                    @keydown.ctrl.enter.prevent="commitEditDescription"
                  />
                </section>

                <section class="space-y-2">
                  <h3 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
                    <ChatBubbleLeftIcon class="size-4 text-muted" aria-hidden="true" />
                    <span>Comments</span>
                    <span v-if="comments.length" class="text-xs font-normal text-muted">{{ comments.length }}</span>
                  </h3>
                  <ul v-if="comments.length" class="space-y-2">
                    <li v-for="comment in comments" :key="comment.id" class="rounded-card bg-surface-2 p-3">
                      <p class="whitespace-pre-wrap text-sm text-text">{{ comment.body }}</p>
                      <div class="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>{{ formatDate(comment.created_at) }}</span>
                        <button
                          type="button"
                          class="inline-flex size-7 items-center justify-center rounded-md text-muted-soft hover:bg-danger-soft hover:text-danger"
                          title="Delete comment"
                          @click="deleteComment(comment)"
                        >
                          <TrashIcon class="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  </ul>
                  <div v-if="action.entity_id" class="space-y-2">
                    <UiTextarea
                      v-model="draftCommentBody"
                      :rows="2"
                      placeholder="Add a thought about this action…"
                      @keydown="handleCommentKey"
                    />
                    <div class="flex items-center justify-between text-xs text-muted">
                      <span>Cmd/Ctrl+Enter to post</span>
                      <UiButton
                        size="sm"
                        :disabled="!draftCommentBody.trim()"
                        :loading="postingComment"
                        @click="postComment"
                      >{{ postingComment ? 'Posting…' : 'Post' }}</UiButton>
                    </div>
                  </div>
                  <p v-else class="text-xs text-muted">Comments become available after the next processing run.</p>
                </section>
              </div>
            </div>
            <div v-else-if="loading" class="flex h-full items-center justify-center text-sm text-muted">Loading…</div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
