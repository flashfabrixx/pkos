<script setup lang="ts">
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  HashtagIcon,
  LightBulbIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UsersIcon,
  FolderIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'
import {
  CheckBadgeIcon as CheckBadgeSolid,
  SparklesIcon as SparklesSolid
} from '@heroicons/vue/24/solid'
import { sourceTypeIcon } from '~/utils/source-type'
import type { ActionStatus, OpenQuestionStatus } from '@bkos/core'

interface ActionRow {
  id: string
  title: string
  status: ActionStatus
  due_date: string | null
  person_id: string | null
  person_name: string | null
  entity_id: string | null
}

interface OpenQuestionRow {
  id: string
  title: string
  status: OpenQuestionStatus
  entity_id: string | null
}

interface DecisionRow {
  id: string
  title: string
  rationale: string | null
  entity_id: string | null
}

interface InsightRow {
  id: string
  title: string
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

const route = useRoute()
const { data, refresh } = await useFetch<any>(`/api/documents/${route.params.id}`)

const document = computed(() => data.value?.document)
const people = computed(() => data.value?.people || [])
const projects = computed(() => data.value?.projects || [])
const tags = computed(() => data.value?.tags || [])

const actions = ref<ActionRow[]>([])
const openQuestions = ref<OpenQuestionRow[]>([])
const decisions = ref<DecisionRow[]>([])
const insights = ref<InsightRow[]>([])
const comments = ref<CommentRow[]>([])

watch(
  data,
  (value) => {
    actions.value = value?.actions || []
    openQuestions.value = value?.openQuestions || []
    decisions.value = value?.decisions || []
    insights.value = value?.insights || []
    comments.value = value?.comments || []
  },
  { immediate: true }
)

const documentEntityId = computed<string | null>(() => data.value?.document?.entity_id || null)

const PROCESSING_STATES = new Set(['new', 'queued', 'processing'])
const isProcessing = computed(() => PROCESSING_STATES.has(document.value?.status))
const isFailed = computed(() => document.value?.status === 'failed')
const primaryDate = computed(() => document.value?.captured_at || document.value?.created_at)

const CONFIDENTIALITY_ICON: Record<string, typeof LockClosedIcon> = {
  private: LockClosedIcon,
  internal: BuildingOfficeIcon,
  sensitive: ShieldExclamationIcon
}
const confidentiality = computed<string | null>(() => {
  const value = document.value?.metadata?.confidentiality
  return typeof value === 'string' && value ? value : null
})
const confidentialityIcon = computed(() => CONFIDENTIALITY_ICON[confidentiality.value || ''] || LockClosedIcon)

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (first + last).toUpperCase() || '?'
}

const isActionDone = (status: ActionStatus | string | null | undefined) =>
  String(status || '').toLowerCase() === 'done'

const isQuestionResolved = (status: OpenQuestionStatus | string | null | undefined) =>
  String(status || '').toLowerCase() === 'resolved'

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const editingActionTitleId = ref<string | null>(null)
const draftActionTitle = ref('')
const titleInputs = ref<Record<string, HTMLInputElement | null>>({})
const dueDateInputs = ref<Record<string, HTMLInputElement | null>>({})

function beginEditActionTitle(action: ActionRow) {
  editingActionTitleId.value = action.id
  draftActionTitle.value = action.title
  void nextTick(() => titleInputs.value[action.id]?.focus())
}
function cancelEditActionTitle() {
  editingActionTitleId.value = null
  draftActionTitle.value = ''
}
async function commitEditActionTitle(action: ActionRow) {
  if (editingActionTitleId.value !== action.id) return
  const next = draftActionTitle.value.trim()
  if (!next || next === action.title) {
    cancelEditActionTitle()
    return
  }
  await patchAction(action, { title: next })
  cancelEditActionTitle()
}

const router = useRouter()
const drawerActionId = computed<string | null>({
  get() {
    const value = route.query.action
    return typeof value === 'string' ? value : null
  },
  set(value) {
    const next = { ...route.query }
    if (value) next.action = value
    else delete next.action
    router.replace({ query: next })
  }
})
function openActionDrawer(id: string) {
  drawerActionId.value = id
}
async function handleDrawerUpdate() {
  await refresh()
}
async function handleDrawerDelete() {
  await refresh()
}

function isOverdueAction(action: ActionRow) {
  if (!action.due_date || isActionDone(action.status) || action.status === 'dismissed') return false
  return String(action.due_date).slice(0, 10) < TODAY_ISO
}

function isTodayAction(action: ActionRow) {
  if (!action.due_date) return false
  return String(action.due_date).slice(0, 10) === TODAY_ISO
}

async function toggleAction(action: ActionRow) {
  const previous = action.status
  const next: ActionStatus = isActionDone(previous) ? 'open' : 'done'
  action.status = next
  try {
    await $fetch(`/api/actions/${action.id}`, { method: 'PATCH', body: { status: next } })
  } catch (error) {
    action.status = previous
    console.error('Failed to update action status', error)
  }
}

async function patchAction(action: ActionRow, body: Record<string, string | null>) {
  try {
    const result = await $fetch<{ action: { person_id: string | null, person_name: string | null, due_date: string | null, title: string } }>(
      `/api/actions/${action.id}`,
      { method: 'PATCH', body }
    )
    action.person_id = result.action.person_id ?? null
    action.person_name = result.action.person_name ?? null
    action.due_date = result.action.due_date ?? null
    action.title = result.action.title ?? action.title
  } catch (error) {
    console.error('Failed to update action', error)
  }
}

function selectActionAssignee(action: ActionRow, person: { id: string, name: string }) {
  void patchAction(action, { personId: person.id })
}
function createActionAssignee(action: ActionRow, payload: { name: string }) {
  void patchAction(action, { personName: payload.name })
}
function clearActionAssignee(action: ActionRow) {
  void patchAction(action, { personId: null })
}

function openDuePicker(action: ActionRow) {
  void nextTick(() => {
    const el = dueDateInputs.value[action.id]
    el?.focus()
    try { (el as unknown as { showPicker?: () => void })?.showPicker?.() } catch {}
  })
}

async function commitDueDate(action: ActionRow, event: Event) {
  const value = (event.target as HTMLInputElement).value || null
  if (value === action.due_date) return
  await patchAction(action, { dueDate: value })
}

const editingDecisionId = ref<string | null>(null)
const draftDecisionTitle = ref('')
const decisionInputs = ref<Record<string, HTMLInputElement | null>>({})

function beginEditDecision(decision: DecisionRow) {
  editingDecisionId.value = decision.id
  draftDecisionTitle.value = decision.title
  void nextTick(() => decisionInputs.value[decision.id]?.focus())
}
function cancelEditDecision() {
  editingDecisionId.value = null
  draftDecisionTitle.value = ''
}
async function commitEditDecision(decision: DecisionRow) {
  if (editingDecisionId.value !== decision.id) return
  const next = draftDecisionTitle.value.trim()
  if (!next || next === decision.title) {
    cancelEditDecision()
    return
  }
  try {
    const result = await $fetch<{ decision: { title: string } }>(`/api/decisions/${decision.id}`, {
      method: 'PATCH',
      body: { title: next }
    })
    decision.title = result.decision.title
  } catch (error) {
    console.error('Failed to update decision', error)
  }
  cancelEditDecision()
}

const editingInsightId = ref<string | null>(null)
const draftInsightTitle = ref('')
const insightInputs = ref<Record<string, HTMLInputElement | null>>({})

function beginEditInsight(insight: InsightRow) {
  editingInsightId.value = insight.id
  draftInsightTitle.value = insight.title
  void nextTick(() => insightInputs.value[insight.id]?.focus())
}
function cancelEditInsight() {
  editingInsightId.value = null
  draftInsightTitle.value = ''
}
async function commitEditInsight(insight: InsightRow) {
  if (editingInsightId.value !== insight.id) return
  const next = draftInsightTitle.value.trim()
  if (!next || next === insight.title) {
    cancelEditInsight()
    return
  }
  try {
    const result = await $fetch<{ insight: { title: string } }>(`/api/insights/${insight.id}`, {
      method: 'PATCH',
      body: { title: next }
    })
    insight.title = result.insight.title
  } catch (error) {
    console.error('Failed to update insight', error)
  }
  cancelEditInsight()
}

const draftCommentBody = ref('')
const postingComment = ref(false)
const originalTextOpen = ref(false)
const rowDrafts = ref<Record<string, string>>({})
const rowPosting = ref<Record<string, boolean>>({})
const expandedThreads = ref<Set<string>>(new Set())

const commentsByEntity = computed(() => {
  const map = new Map<string, CommentRow[]>()
  for (const comment of comments.value) {
    const list = map.get(comment.entity_id) || []
    list.push(comment)
    map.set(comment.entity_id, list)
  }
  return map
})

function commentsFor(entityId: string | null): CommentRow[] {
  if (!entityId) return []
  return commentsByEntity.value.get(entityId) || []
}

function toggleThread(entityId: string | null) {
  if (!entityId) return
  const next = new Set(expandedThreads.value)
  if (next.has(entityId)) next.delete(entityId)
  else next.add(entityId)
  expandedThreads.value = next
}

function isThreadOpen(entityId: string | null) {
  return !!entityId && expandedThreads.value.has(entityId)
}

async function postCommentOn(entityId: string | null, draftKey: string) {
  if (!entityId) return
  const body = (rowDrafts.value[draftKey] || '').trim()
  if (!body || rowPosting.value[draftKey]) return
  rowPosting.value[draftKey] = true
  try {
    const result = await $fetch<{ comment: CommentRow }>('/api/comments', {
      method: 'POST',
      body: {
        entityId,
        documentId: document.value?.id,
        body
      }
    })
    comments.value.push(result.comment)
    rowDrafts.value[draftKey] = ''
  } catch (error) {
    console.error('Failed to post comment', error)
  } finally {
    rowPosting.value[draftKey] = false
  }
}

async function postComment() {
  if (!documentEntityId.value || postingComment.value) return
  const body = draftCommentBody.value.trim()
  if (!body) return
  postingComment.value = true
  try {
    const result = await $fetch<{ comment: CommentRow }>('/api/comments', {
      method: 'POST',
      body: {
        entityId: documentEntityId.value,
        documentId: document.value?.id,
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

function handleRowCommentKey(event: KeyboardEvent, entityId: string | null, draftKey: string) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void postCommentOn(entityId, draftKey)
  }
}

async function toggleQuestion(question: OpenQuestionRow) {
  const previous = question.status
  const next: OpenQuestionStatus = isQuestionResolved(previous) ? 'open' : 'resolved'
  question.status = next
  try {
    await $fetch(`/api/open-questions/${question.id}`, { method: 'PATCH', body: { status: next } })
  } catch (error) {
    question.status = previous
    console.error('Failed to update question status', error)
  }
}

function searchLinkFor(term: string) {
  return { path: '/search', query: { q: term } }
}
</script>

<template>
  <div>
    <ActionDrawer
      v-model:action-id="drawerActionId"
      @updated="handleDrawerUpdate"
      @deleted="handleDrawerDelete"
    />
    <main v-if="document" class="workspace document-grid">
      <section class="panel document-main">
        <header class="doc-header">
          <div class="doc-header-title">
            <h1>{{ document.title }}</h1>
            <span v-if="isProcessing" class="status-pill status-pill--pending">
              <ArrowPathIcon class="size-3.5 status-pill-spin" aria-hidden="true" />
              <span>Processing</span>
            </span>
            <span v-else-if="isFailed" class="status-pill status-pill--error">
              <ExclamationTriangleIcon class="size-3.5" aria-hidden="true" />
              <span>Processing failed</span>
            </span>
          </div>

          <div class="document-meta">
            <span v-if="primaryDate">
              <CalendarDaysIcon class="size-4" aria-hidden="true" />
              <span>{{ formatDate(primaryDate) }}</span>
            </span>
            <span>
              <component :is="sourceTypeIcon(document.source_type)" class="size-4" aria-hidden="true" />
              <span>{{ document.source_type }}</span>
            </span>
            <span v-if="people.length">
              <UsersIcon class="size-4" aria-hidden="true" />
              <span>{{ people.length }} {{ people.length === 1 ? 'person' : 'people' }}</span>
            </span>
            <span v-if="confidentiality" :class="['confidentiality', `confidentiality--${confidentiality}`]">
              <component :is="confidentialityIcon" class="size-4" aria-hidden="true" />
              <span>{{ confidentiality }}</span>
            </span>
          </div>
        </header>

        <section v-if="document.summary" class="doc-lead">
          <p>{{ document.summary }}</p>
        </section>

        <section v-if="actions.length" class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <ClipboardDocumentCheckIcon class="size-5 text-slate-500" aria-hidden="true" />
              <h2>Actions</h2>
              <span class="count">{{ actions.length }}</span>
            </div>
          </div>
          <ul class="doc-action-list">
            <template v-for="action in actions" :key="action.id">
              <li
                class="doc-action-row"
                :class="{ 'is-done': isActionDone(action.status) }"
              >
                <button
                  type="button"
                  class="doc-action-check"
                  :class="isActionDone(action.status) ? 'is-done' : 'is-open'"
                  :aria-pressed="isActionDone(action.status)"
                  :aria-label="isActionDone(action.status) ? 'Mark action as open' : 'Mark action as done'"
                  @click="toggleAction(action)"
                >
                  <CheckCircleIcon class="size-5" aria-hidden="true" />
                </button>

                <div class="doc-action-title">
                  <button
                    v-if="editingActionTitleId !== action.id"
                    type="button"
                    class="doc-action-title-trigger"
                    @click="beginEditActionTitle(action)"
                  >
                    <span :class="{ 'is-done': isActionDone(action.status) }">{{ action.title }}</span>
                  </button>
                  <input
                    v-else
                    :ref="(el) => titleInputs[action.id] = el as HTMLInputElement | null"
                    v-model="draftActionTitle"
                    class="doc-action-title-input"
                    type="text"
                    maxlength="500"
                    @blur="commitEditActionTitle(action)"
                    @keydown.enter.prevent="commitEditActionTitle(action)"
                    @keydown.esc.prevent="cancelEditActionTitle"
                  >
                  <button
                    type="button"
                    class="row-open-chevron"
                    title="Open action detail"
                    @click="openActionDrawer(action.id)"
                  >
                    <ChevronRightIcon class="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div class="doc-action-assignee">
                  <AssigneePicker
                    :person-id="action.person_id"
                    :person-name="action.person_name"
                    @select="(person) => selectActionAssignee(action, person)"
                    @create="(payload) => createActionAssignee(action, payload)"
                    @clear="clearActionAssignee(action)"
                  />
                </div>

                <div class="doc-action-due">
                  <button
                    type="button"
                    class="doc-action-due-trigger"
                    :class="{
                      'is-overdue': isOverdueAction(action),
                      'is-today': isTodayAction(action),
                      'is-empty': !action.due_date
                    }"
                    :title="action.due_date ? formatDate(action.due_date) : 'Set due date'"
                    @click="openDuePicker(action)"
                  >
                    <CalendarDaysIcon
                      v-if="!action.due_date"
                      class="size-4 asana-due-empty-icon"
                      aria-hidden="true"
                    />
                    <span v-else>{{ isTodayAction(action) ? 'Today' : formatDate(action.due_date) }}</span>
                  </button>
                  <input
                    :ref="(el) => dueDateInputs[action.id] = el as HTMLInputElement | null"
                    type="date"
                    class="doc-action-due-input"
                    :value="action.due_date || ''"
                    @change="commitDueDate(action, $event)"
                  >
                </div>

              </li>
              <li v-if="false" class="doc-row-thread">
                <div v-if="commentsFor(action.entity_id).length" class="doc-row-thread-comments">
                  <div v-for="c in commentsFor(action.entity_id)" :key="c.id" class="doc-comment doc-comment--inline">
                    <div class="doc-comment-body">{{ c.body }}</div>
                    <div class="doc-comment-meta">
                      <span>{{ formatDate(c.created_at) }}</span>
                      <button type="button" class="doc-comment-delete" title="Delete comment" @click="deleteComment(c)">
                        <TrashIcon class="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                <div class="doc-row-thread-compose">
                  <textarea
                    v-model="rowDrafts[action.entity_id!]"
                    class="doc-comment-textarea doc-comment-textarea--inline"
                    rows="2"
                    placeholder="Add a thought…"
                    @keydown="handleRowCommentKey($event, action.entity_id, action.entity_id!)"
                  />
                  <div class="doc-comment-compose-actions">
                    <span class="doc-comment-hint">Cmd/Ctrl+Enter to post</span>
                    <button
                      type="button"
                      class="doc-comment-post"
                      :disabled="!(rowDrafts[action.entity_id!] || '').trim() || rowPosting[action.entity_id!]"
                      @click="postCommentOn(action.entity_id, action.entity_id!)"
                    >
                      {{ rowPosting[action.entity_id!] ? 'Posting…' : 'Post' }}
                    </button>
                  </div>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="decisions.length" class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <FlagIcon class="size-5 text-slate-500" aria-hidden="true" />
              <h2>Decisions</h2>
              <span class="count">{{ decisions.length }}</span>
            </div>
          </div>
          <ul class="doc-list">
            <template v-for="decision in decisions" :key="decision.id">
              <li class="doc-list-row">
                <span class="doc-row-marker doc-row-marker-decision">
                  <CheckBadgeSolid class="size-4" aria-hidden="true" />
                </span>
                <div class="doc-row-body">
                  <button
                    v-if="editingDecisionId !== decision.id"
                    type="button"
                    class="doc-row-edit-trigger"
                    @click="beginEditDecision(decision)"
                  >
                    <span class="doc-row-title">{{ decision.title }}</span>
                  </button>
                  <input
                    v-else
                    :ref="(el) => decisionInputs[decision.id] = el as HTMLInputElement | null"
                    v-model="draftDecisionTitle"
                    class="doc-row-edit-input"
                    type="text"
                    maxlength="500"
                    @blur="commitEditDecision(decision)"
                    @keydown.enter.prevent="commitEditDecision(decision)"
                    @keydown.esc.prevent="cancelEditDecision"
                  >
                  <small v-if="decision.rationale">{{ decision.rationale }}</small>
                </div>
                <button
                  v-if="decision.entity_id"
                  type="button"
                  class="doc-row-comment-toggle"
                  :class="{ 'has-comments': commentsFor(decision.entity_id).length > 0, 'is-active': isThreadOpen(decision.entity_id) }"
                  :title="commentsFor(decision.entity_id).length ? `${commentsFor(decision.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(decision.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(decision.entity_id).length">{{ commentsFor(decision.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(decision.entity_id)" class="doc-row-thread">
                <div v-if="commentsFor(decision.entity_id).length" class="doc-row-thread-comments">
                  <div v-for="c in commentsFor(decision.entity_id)" :key="c.id" class="doc-comment doc-comment--inline">
                    <div class="doc-comment-body">{{ c.body }}</div>
                    <div class="doc-comment-meta">
                      <span>{{ formatDate(c.created_at) }}</span>
                      <button type="button" class="doc-comment-delete" title="Delete comment" @click="deleteComment(c)">
                        <TrashIcon class="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                <div class="doc-row-thread-compose">
                  <textarea
                    v-model="rowDrafts[decision.entity_id!]"
                    class="doc-comment-textarea doc-comment-textarea--inline"
                    rows="2"
                    placeholder="Add a thought…"
                    @keydown="handleRowCommentKey($event, decision.entity_id, decision.entity_id!)"
                  />
                  <div class="doc-comment-compose-actions">
                    <span class="doc-comment-hint">Cmd/Ctrl+Enter to post</span>
                    <button
                      type="button"
                      class="doc-comment-post"
                      :disabled="!(rowDrafts[decision.entity_id!] || '').trim() || rowPosting[decision.entity_id!]"
                      @click="postCommentOn(decision.entity_id, decision.entity_id!)"
                    >
                      {{ rowPosting[decision.entity_id!] ? 'Posting…' : 'Post' }}
                    </button>
                  </div>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="insights.length" class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <LightBulbIcon class="size-5 text-slate-500" aria-hidden="true" />
              <h2>Insights</h2>
              <span class="count">{{ insights.length }}</span>
            </div>
          </div>
          <ul class="doc-list">
            <template v-for="insight in insights" :key="insight.id">
              <li class="doc-list-row">
                <span class="doc-row-marker doc-row-marker-insight">
                  <SparklesSolid class="size-4" aria-hidden="true" />
                </span>
                <button
                  v-if="editingInsightId !== insight.id"
                  type="button"
                  class="doc-row-edit-trigger"
                  @click="beginEditInsight(insight)"
                >
                  <span class="doc-row-title">{{ insight.title }}</span>
                </button>
                <input
                  v-else
                  :ref="(el) => insightInputs[insight.id] = el as HTMLInputElement | null"
                  v-model="draftInsightTitle"
                  class="doc-row-edit-input"
                  type="text"
                  maxlength="500"
                  @blur="commitEditInsight(insight)"
                  @keydown.enter.prevent="commitEditInsight(insight)"
                  @keydown.esc.prevent="cancelEditInsight"
                >
                <button
                  v-if="insight.entity_id"
                  type="button"
                  class="doc-row-comment-toggle"
                  :class="{ 'has-comments': commentsFor(insight.entity_id).length > 0, 'is-active': isThreadOpen(insight.entity_id) }"
                  :title="commentsFor(insight.entity_id).length ? `${commentsFor(insight.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(insight.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(insight.entity_id).length">{{ commentsFor(insight.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(insight.entity_id)" class="doc-row-thread">
                <div v-if="commentsFor(insight.entity_id).length" class="doc-row-thread-comments">
                  <div v-for="c in commentsFor(insight.entity_id)" :key="c.id" class="doc-comment doc-comment--inline">
                    <div class="doc-comment-body">{{ c.body }}</div>
                    <div class="doc-comment-meta">
                      <span>{{ formatDate(c.created_at) }}</span>
                      <button type="button" class="doc-comment-delete" title="Delete comment" @click="deleteComment(c)">
                        <TrashIcon class="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                <div class="doc-row-thread-compose">
                  <textarea
                    v-model="rowDrafts[insight.entity_id!]"
                    class="doc-comment-textarea doc-comment-textarea--inline"
                    rows="2"
                    placeholder="Add a thought…"
                    @keydown="handleRowCommentKey($event, insight.entity_id, insight.entity_id!)"
                  />
                  <div class="doc-comment-compose-actions">
                    <span class="doc-comment-hint">Cmd/Ctrl+Enter to post</span>
                    <button
                      type="button"
                      class="doc-comment-post"
                      :disabled="!(rowDrafts[insight.entity_id!] || '').trim() || rowPosting[insight.entity_id!]"
                      @click="postCommentOn(insight.entity_id, insight.entity_id!)"
                    >
                      {{ rowPosting[insight.entity_id!] ? 'Posting…' : 'Post' }}
                    </button>
                  </div>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="openQuestions.length" class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <QuestionMarkCircleIcon class="size-5 text-slate-500" aria-hidden="true" />
              <h2>Open questions</h2>
              <span class="count">{{ openQuestions.length }}</span>
            </div>
          </div>
          <ul class="doc-list">
            <template v-for="question in openQuestions" :key="question.id">
              <li
                class="doc-list-row"
                :class="{ 'is-done': isQuestionResolved(question.status) }"
              >
                <button
                  type="button"
                  class="checkbox doc-row-marker-button"
                  :class="{ 'is-checked': isQuestionResolved(question.status) }"
                  :aria-pressed="isQuestionResolved(question.status)"
                  :aria-label="isQuestionResolved(question.status) ? 'Mark question as open' : 'Mark question as resolved'"
                  @click="toggleQuestion(question)"
                >
                  <CheckIcon v-if="isQuestionResolved(question.status)" class="size-3" aria-hidden="true" />
                </button>
                <span class="doc-row-title" :class="{ 'is-done': isQuestionResolved(question.status) }">{{ question.title }}</span>
                <button
                  v-if="question.entity_id"
                  type="button"
                  class="doc-row-comment-toggle"
                  :class="{ 'has-comments': commentsFor(question.entity_id).length > 0, 'is-active': isThreadOpen(question.entity_id) }"
                  :title="commentsFor(question.entity_id).length ? `${commentsFor(question.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(question.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(question.entity_id).length">{{ commentsFor(question.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(question.entity_id)" class="doc-row-thread">
                <div v-if="commentsFor(question.entity_id).length" class="doc-row-thread-comments">
                  <div v-for="c in commentsFor(question.entity_id)" :key="c.id" class="doc-comment doc-comment--inline">
                    <div class="doc-comment-body">{{ c.body }}</div>
                    <div class="doc-comment-meta">
                      <span>{{ formatDate(c.created_at) }}</span>
                      <button type="button" class="doc-comment-delete" title="Delete comment" @click="deleteComment(c)">
                        <TrashIcon class="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                <div class="doc-row-thread-compose">
                  <textarea
                    v-model="rowDrafts[question.entity_id!]"
                    class="doc-comment-textarea doc-comment-textarea--inline"
                    rows="2"
                    placeholder="Add a thought…"
                    @keydown="handleRowCommentKey($event, question.entity_id, question.entity_id!)"
                  />
                  <div class="doc-comment-compose-actions">
                    <span class="doc-comment-hint">Cmd/Ctrl+Enter to post</span>
                    <button
                      type="button"
                      class="doc-comment-post"
                      :disabled="!(rowDrafts[question.entity_id!] || '').trim() || rowPosting[question.entity_id!]"
                      @click="postCommentOn(question.entity_id, question.entity_id!)"
                    >
                      {{ rowPosting[question.entity_id!] ? 'Posting…' : 'Post' }}
                    </button>
                  </div>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="documentEntityId" class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <ChatBubbleLeftIcon class="size-5 text-slate-500" aria-hidden="true" />
              <h2>Comments</h2>
              <span v-if="commentsFor(documentEntityId).length" class="count">{{ commentsFor(documentEntityId).length }}</span>
            </div>
          </div>

          <ul v-if="commentsFor(documentEntityId).length" class="doc-comment-list">
            <li v-for="comment in commentsFor(documentEntityId)" :key="comment.id" class="doc-comment">
              <div class="doc-comment-body">{{ comment.body }}</div>
              <div class="doc-comment-meta">
                <span>{{ formatDate(comment.created_at) }}</span>
                <button
                  type="button"
                  class="doc-comment-delete"
                  :title="'Delete comment'"
                  @click="deleteComment(comment)"
                >
                  <TrashIcon class="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>

          <div class="doc-comment-compose">
            <textarea
              v-model="draftCommentBody"
              class="doc-comment-textarea"
              rows="2"
              placeholder="Add a thought, idea, or question..."
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
        </section>

        <div class="doc-advanced">
          <details ref="originalTextDetails" class="doc-disclose" @toggle="originalTextOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="doc-disclose-trigger">
              <DocumentTextIcon class="size-4 text-slate-500" aria-hidden="true" />
              <span>{{ originalTextOpen ? 'Hide original text' : 'Show original text' }}</span>
            </summary>
            <pre class="raw-text">{{ document.raw_text }}</pre>
          </details>
        </div>
      </section>

      <aside class="panel side-panel side-panel--flat">
        <section v-if="people.length" class="side-section">
          <div class="side-section-head">
            <UsersIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>People</h3>
            <span class="count">{{ people.length }}</span>
          </div>
          <ul class="people-list">
            <li v-for="person in people" :key="person.id">
              <NuxtLink :to="`/people/${person.id}`" class="entity-link">
                <span class="avatar" :title="person.name">{{ initialsOf(person.name) }}</span>
                <span class="person-name">{{ person.name }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="projects.length" class="side-section">
          <div class="side-section-head">
            <FolderIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>Projects</h3>
          </div>
          <ul class="project-list">
            <li v-for="project in projects" :key="project.id">
              <NuxtLink :to="`/projects/${project.id}`" class="entity-link">{{ project.name }}</NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="tags.length" class="side-section">
          <div class="side-section-head">
            <HashtagIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>Tags</h3>
          </div>
          <div class="tag-list">
            <NuxtLink v-for="t in tags" :key="t.id" :to="`/tags/${t.id}`" class="tag">#{{ t.name }}</NuxtLink>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
