<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  HashtagIcon,
  LightBulbIcon,
  LanguageIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UsersIcon,
  FolderIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import {
  CheckBadgeIcon as CheckBadgeSolid,
  SparklesIcon as SparklesSolid
} from '@heroicons/vue/24/solid'
import { sourceTypeIcon } from '~/utils/source-type'
import type { ActionStatus, OpenQuestionStatus } from '@pkos/core'

const LANGUAGE_OPTIONS: Array<{ code: string, label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'no', label: 'Norsk' },
  { code: 'hu', label: 'Magyar' },
  { code: 'ro', label: 'Română' },
  { code: 'tr', label: 'Türkçe' }
]

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

interface EntityRow { id: string, name: string }

// People / projects / tags are local refs (not computeds) so the inline
// edit / attach / detach operations can mutate them optimistically and
// settle on the server response without a full refresh.
const people = ref<EntityRow[]>([])
const projects = ref<EntityRow[]>([])
const tags = ref<EntityRow[]>([])

useHead({ title: () => document.value?.title || 'Capture' })

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
    people.value = value?.people || []
    projects.value = value?.projects || []
    tags.value = value?.tags || []
  },
  { immediate: true }
)

type EntityKind = 'person' | 'project' | 'tag'
const ENTITY_LIST_REFS: Record<EntityKind, typeof people> = {
  person: people,
  project: projects,
  tag: tags
}
const ENTITY_DETAIL_BASE: Record<EntityKind, string> = {
  person: '/people',
  project: '/projects',
  tag: '/tags'
}

async function detachEntity(kind: EntityKind, row: EntityRow) {
  if (!document.value) return
  const list = ENTITY_LIST_REFS[kind].value
  const idx = list.findIndex((r) => r.id === row.id)
  if (idx === -1) return
  const removed = list.splice(idx, 1)[0] // optimistic
  try {
    await $fetch(`/api/documents/${document.value.id}/entities/${row.id}`, { method: 'DELETE' })
  } catch (error) {
    list.splice(idx, 0, removed!)
    console.error(`Failed to detach ${kind}`, error)
  }
}

async function attachEntity(kind: EntityKind, payload: { id?: string, name: string }) {
  if (!document.value) return
  try {
    const body = payload.id ? { entityId: payload.id } : { type: kind, name: payload.name }
    const result = await $fetch<{ entity: { id: string, name: string, type: string } }>(
      `/api/documents/${document.value.id}/entities`,
      { method: 'POST', body }
    )
    const list = ENTITY_LIST_REFS[kind].value
    if (!list.find((r) => r.id === result.entity.id)) {
      list.push({ id: result.entity.id, name: result.entity.name })
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
  } catch (error) {
    console.error(`Failed to attach ${kind}`, error)
  }
}

const currentLanguageLabel = computed(() => {
  const code = document.value?.language
  if (!code) return 'Auto'
  return LANGUAGE_OPTIONS.find((opt) => opt.code === code)?.label || code.toUpperCase()
})
const currentLanguageShort = computed(() => {
  const code = document.value?.language
  return code ? code.toUpperCase() : 'AUTO'
})

async function updateLanguage(code: string | null) {
  if (!document.value) return
  try {
    await $fetch(`/api/documents/${document.value.id}`, { method: 'PATCH', body: { language: code } })
    await refresh()
  } catch (error) {
    console.error('Failed to update language', error)
  }
}

const reprocessing = ref(false)
async function reprocessDocument() {
  if (!document.value || reprocessing.value) return
  reprocessing.value = true
  try {
    await $fetch(`/api/documents/${document.value.id}/reprocess`, { method: 'POST' })
    await refresh()
  } catch (error) {
    console.error('Failed to reprocess document', error)
  } finally {
    reprocessing.value = false
  }
}

async function deleteDocument() {
  if (!document.value) return
  if (!confirm('Move this capture to trash? You can restore it later from the trash page.')) return
  try {
    await $fetch(`/api/documents/${document.value.id}`, { method: 'DELETE' })
    await navigateTo('/documents')
  } catch (error) {
    console.error('Failed to delete document', error)
  }
}

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
function openActionDrawer(id: string) { drawerActionId.value = id }
async function handleDrawerUpdate() { await refresh() }
async function handleDrawerDelete() { await refresh() }

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
  if (!next || next === decision.title) { cancelEditDecision(); return }
  try {
    const result = await $fetch<{ decision: { title: string } }>(`/api/decisions/${decision.id}`, { method: 'PATCH', body: { title: next } })
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
  if (!next || next === insight.title) { cancelEditInsight(); return }
  try {
    const result = await $fetch<{ insight: { title: string } }>(`/api/insights/${insight.id}`, { method: 'PATCH', body: { title: next } })
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
      body: { entityId, documentId: document.value?.id, body }
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
      body: { entityId: documentEntityId.value, documentId: document.value?.id, body }
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

const confidentialityBadge = computed(() => {
  switch (confidentiality.value) {
    case 'private': return 'danger'
    case 'sensitive': return 'warning'
    default: return 'accent'
  }
})
</script>

<template>
  <div>
    <ActionDrawer
      v-model:action-id="drawerActionId"
      @updated="handleDrawerUpdate"
      @deleted="handleDrawerDelete"
    />
    <main v-if="document" class="mx-auto grid max-w-[1280px] gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section class="space-y-6 rounded-card border border-border-default bg-surface-1 p-6 shadow-card">
        <header class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h1 class="text-2xl font-semibold tracking-tight text-text-strong">{{ document.title }}</h1>
              <div v-if="isProcessing || isFailed" class="mt-2">
                <UiBadge v-if="isProcessing" variant="warning">
                  <ArrowPathIcon class="size-3.5 animate-spin" aria-hidden="true" />
                  Processing
                </UiBadge>
                <UiBadge v-else-if="isFailed" variant="danger">
                  <ExclamationTriangleIcon class="size-3.5" aria-hidden="true" />
                  Processing failed
                </UiBadge>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="reprocessing || isProcessing"
                :loading="reprocessing"
                @click="reprocessDocument"
              >
                <ArrowPathIcon v-if="!reprocessing" class="size-4" aria-hidden="true" />
                {{ reprocessing ? 'Reprocessing…' : 'Reprocess' }}
              </UiButton>
              <UiButton variant="ghost" size="sm" @click="deleteDocument">
                <TrashIcon class="size-4" aria-hidden="true" />
                Delete
              </UiButton>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs text-text-soft">
            <span v-if="primaryDate" class="inline-flex items-center gap-1.5">
              <CalendarDaysIcon class="size-4" aria-hidden="true" />
              <span>{{ formatDate(primaryDate) }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <component :is="sourceTypeIcon(document.source_type)" class="size-4" aria-hidden="true" />
              <span>{{ document.source_type }}</span>
            </span>
            <span v-if="people.length" class="inline-flex items-center gap-1.5">
              <UsersIcon class="size-4" aria-hidden="true" />
              <span>{{ people.length }} {{ people.length === 1 ? 'person' : 'people' }}</span>
            </span>
            <UiBadge v-if="confidentiality" :variant="confidentialityBadge">
              <component :is="confidentialityIcon" class="size-3.5" aria-hidden="true" />
              <span>{{ confidentiality }}</span>
            </UiBadge>
            <Menu as="span" class="relative inline-flex">
              <MenuButton
                class="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2 py-1 text-xs font-medium text-text-soft hover:bg-surface-3"
                :title="`Click to override (currently: ${currentLanguageLabel})`"
              >
                <LanguageIcon class="size-4" aria-hidden="true" />
                <span>{{ currentLanguageShort }}</span>
                <ChevronDownIcon class="size-3" aria-hidden="true" />
              </MenuButton>
              <MenuItems class="absolute right-0 top-full z-30 mt-1 max-h-72 w-48 overflow-auto rounded-md border border-border-default bg-surface-1 py-1 text-sm shadow-popover focus:outline-none">
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="[
                      'flex w-full items-center px-3 py-1.5 text-left text-sm',
                      active ? 'bg-accent-soft text-accent' : 'text-text',
                      !document.language && 'font-semibold'
                    ]"
                    @click="updateLanguage(null)"
                  >Auto · detect</button>
                </MenuItem>
                <MenuItem v-for="option in LANGUAGE_OPTIONS" :key="option.code" v-slot="{ active }">
                  <button
                    type="button"
                    :class="[
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                      active ? 'bg-accent-soft text-accent' : 'text-text',
                      document.language === option.code && 'font-semibold'
                    ]"
                    @click="updateLanguage(option.code)"
                  >
                    <span class="font-mono text-[11px] text-muted">{{ option.code.toUpperCase() }}</span>
                    <span>{{ option.label }}</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </header>

        <section v-if="document.metadata?.derived_from?.thread_id" class="flex items-center gap-2 text-xs text-muted">
          <ArrowUturnLeftIcon class="size-4 text-muted-soft" aria-hidden="true" />
          <span>Derived from thread</span>
          <NuxtLink :to="`/threads/${document.metadata.derived_from.thread_id}`" class="font-medium text-accent hover:underline">
            {{ document.metadata.derived_from.thread_id.slice(0, 8) }}
          </NuxtLink>
          <template v-if="Array.isArray(document.metadata.derived_from.source_documents) && document.metadata.derived_from.source_documents.length">
            <span aria-hidden="true">·</span>
            <span>{{ document.metadata.derived_from.source_documents.length }} source captures</span>
          </template>
        </section>

        <section v-if="document.summary" class="rounded-card bg-accent-soft p-4">
          <p class="text-sm leading-relaxed text-text">{{ document.summary }}</p>
        </section>

        <section v-if="actions.length" class="space-y-2">
          <div class="flex items-center gap-2">
            <ClipboardDocumentCheckIcon class="size-5 text-muted" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-text-strong">Actions</h2>
            <span class="text-xs text-muted">{{ actions.length }}</span>
          </div>
          <ul class="divide-y divide-border-subtle">
            <li
              v-for="action in actions"
              :key="action.id"
              class="group grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 py-2"
              :class="isActionDone(action.status) && 'opacity-70'"
            >
              <button
                type="button"
                :class="[
                  'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                  isActionDone(action.status)
                    ? 'text-success hover:bg-success-soft'
                    : 'text-muted-soft hover:bg-success-soft hover:text-success'
                ]"
                :aria-pressed="isActionDone(action.status)"
                :aria-label="isActionDone(action.status) ? 'Mark action as open' : 'Mark action as done'"
                @click="toggleAction(action)"
              >
                <CheckCircleIcon class="size-5" aria-hidden="true" />
              </button>

              <div class="flex min-w-0 items-center gap-2">
                <button
                  v-if="editingActionTitleId !== action.id"
                  type="button"
                  class="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm text-text hover:bg-surface-3"
                  @click="beginEditActionTitle(action)"
                >
                  <span :class="isActionDone(action.status) && 'text-muted line-through'">{{ action.title }}</span>
                </button>
                <input
                  v-else
                  :ref="(el: any) => titleInputs[action.id] = el as HTMLInputElement | null"
                  v-model="draftActionTitle"
                  class="min-w-0 flex-1 rounded-md border border-accent bg-surface-1 px-2 py-1 text-sm text-text outline-none focus:ring-2 focus:ring-accent/20"
                  type="text"
                  maxlength="500"
                  @blur="commitEditActionTitle(action)"
                  @keydown.enter.prevent="commitEditActionTitle(action)"
                  @keydown.esc.prevent="cancelEditActionTitle"
                >
                <button
                  type="button"
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-soft opacity-0 transition-opacity hover:bg-surface-3 hover:text-text group-hover:opacity-100"
                  title="Open action detail"
                  @click="openActionDrawer(action.id)"
                >
                  <ChevronRightIcon class="size-4" aria-hidden="true" />
                </button>
              </div>

              <div class="min-w-0">
                <AssigneePicker
                  :person-id="action.person_id"
                  :person-name="action.person_name"
                  @select="(person) => selectActionAssignee(action, person)"
                  @create="(payload) => createActionAssignee(action, payload)"
                  @clear="clearActionAssignee(action)"
                />
              </div>

              <div class="relative min-w-0">
                <button
                  type="button"
                  :class="[
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-surface-3',
                    isOverdueAction(action) && 'text-danger',
                    isTodayAction(action) && !isOverdueAction(action) && 'text-warning',
                    !action.due_date && 'text-muted-soft'
                  ]"
                  :title="action.due_date ? formatDate(action.due_date) : 'Set due date'"
                  @click="openDuePicker(action)"
                >
                  <CalendarDaysIcon v-if="!action.due_date" class="size-4" aria-hidden="true" />
                  <span v-else>{{ isTodayAction(action) ? 'Today' : formatDate(action.due_date) }}</span>
                </button>
                <input
                  :ref="(el: any) => dueDateInputs[action.id] = el as HTMLInputElement | null"
                  type="date"
                  class="pointer-events-none absolute inset-0 opacity-0"
                  :value="action.due_date || ''"
                  @change="commitDueDate(action, $event)"
                >
              </div>
            </li>
          </ul>
        </section>

        <section v-if="decisions.length" class="space-y-2">
          <div class="flex items-center gap-2">
            <FlagIcon class="size-5 text-muted" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-text-strong">Decisions</h2>
            <span class="text-xs text-muted">{{ decisions.length }}</span>
          </div>
          <ul class="divide-y divide-border-subtle">
            <template v-for="decision in decisions" :key="decision.id">
              <li class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 py-2">
                <span class="mt-1 inline-flex size-5 items-center justify-center text-success">
                  <CheckBadgeSolid class="size-4" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <button
                    v-if="editingDecisionId !== decision.id"
                    type="button"
                    class="-mx-2 block w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-3"
                    @click="beginEditDecision(decision)"
                  >
                    <span class="block text-sm font-medium text-text">{{ decision.title }}</span>
                  </button>
                  <input
                    v-else
                    :ref="(el: any) => decisionInputs[decision.id] = el as HTMLInputElement | null"
                    v-model="draftDecisionTitle"
                    class="block w-full rounded-md border border-accent bg-surface-1 px-2 py-1 text-sm text-text outline-none focus:ring-2 focus:ring-accent/20"
                    type="text"
                    maxlength="500"
                    @blur="commitEditDecision(decision)"
                    @keydown.enter.prevent="commitEditDecision(decision)"
                    @keydown.esc.prevent="cancelEditDecision"
                  >
                  <small v-if="decision.rationale" class="mt-0.5 block text-xs text-muted">{{ decision.rationale }}</small>
                </div>
                <button
                  v-if="decision.entity_id"
                  type="button"
                  :class="[
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-3 hover:text-text',
                    isThreadOpen(decision.entity_id) && 'bg-surface-3 text-text',
                    commentsFor(decision.entity_id).length && 'text-accent'
                  ]"
                  :title="commentsFor(decision.entity_id).length ? `${commentsFor(decision.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(decision.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(decision.entity_id).length">{{ commentsFor(decision.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(decision.entity_id)" class="ml-8 space-y-2 border-l-2 border-border-subtle py-2 pl-4">
                <div v-for="c in commentsFor(decision.entity_id)" :key="c.id" class="rounded-md bg-surface-2 p-2 text-sm">
                  <div class="whitespace-pre-wrap text-text">{{ c.body }}</div>
                  <div class="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{{ formatDate(c.created_at) }}</span>
                    <button type="button" class="inline-flex size-6 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger" title="Delete comment" @click="deleteComment(c)">
                      <TrashIcon class="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <UiTextarea
                  v-model="rowDrafts[decision.entity_id!]"
                  :rows="2"
                  placeholder="Add a thought…"
                  @keydown="handleRowCommentKey($event, decision.entity_id, decision.entity_id!)"
                />
                <div class="flex items-center justify-between text-xs text-muted">
                  <span>Cmd/Ctrl+Enter to post</span>
                  <UiButton
                    size="sm"
                    :disabled="!(rowDrafts[decision.entity_id!] || '').trim()"
                    :loading="!!rowPosting[decision.entity_id!]"
                    @click="postCommentOn(decision.entity_id, decision.entity_id!)"
                  >{{ rowPosting[decision.entity_id!] ? 'Posting…' : 'Post' }}</UiButton>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="insights.length" class="space-y-2">
          <div class="flex items-center gap-2">
            <LightBulbIcon class="size-5 text-muted" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-text-strong">Insights</h2>
            <span class="text-xs text-muted">{{ insights.length }}</span>
          </div>
          <ul class="divide-y divide-border-subtle">
            <template v-for="insight in insights" :key="insight.id">
              <li class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-2">
                <span class="inline-flex size-5 items-center justify-center text-warning">
                  <SparklesSolid class="size-4" aria-hidden="true" />
                </span>
                <button
                  v-if="editingInsightId !== insight.id"
                  type="button"
                  class="-mx-2 min-w-0 truncate rounded-md px-2 py-1 text-left text-sm text-text hover:bg-surface-3"
                  @click="beginEditInsight(insight)"
                >{{ insight.title }}</button>
                <input
                  v-else
                  :ref="(el: any) => insightInputs[insight.id] = el as HTMLInputElement | null"
                  v-model="draftInsightTitle"
                  class="min-w-0 rounded-md border border-accent bg-surface-1 px-2 py-1 text-sm text-text outline-none focus:ring-2 focus:ring-accent/20"
                  type="text"
                  maxlength="500"
                  @blur="commitEditInsight(insight)"
                  @keydown.enter.prevent="commitEditInsight(insight)"
                  @keydown.esc.prevent="cancelEditInsight"
                >
                <button
                  v-if="insight.entity_id"
                  type="button"
                  :class="[
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-3 hover:text-text',
                    isThreadOpen(insight.entity_id) && 'bg-surface-3 text-text',
                    commentsFor(insight.entity_id).length && 'text-accent'
                  ]"
                  :title="commentsFor(insight.entity_id).length ? `${commentsFor(insight.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(insight.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(insight.entity_id).length">{{ commentsFor(insight.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(insight.entity_id)" class="ml-8 space-y-2 border-l-2 border-border-subtle py-2 pl-4">
                <div v-for="c in commentsFor(insight.entity_id)" :key="c.id" class="rounded-md bg-surface-2 p-2 text-sm">
                  <div class="whitespace-pre-wrap text-text">{{ c.body }}</div>
                  <div class="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{{ formatDate(c.created_at) }}</span>
                    <button type="button" class="inline-flex size-6 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger" title="Delete comment" @click="deleteComment(c)">
                      <TrashIcon class="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <UiTextarea
                  v-model="rowDrafts[insight.entity_id!]"
                  :rows="2"
                  placeholder="Add a thought…"
                  @keydown="handleRowCommentKey($event, insight.entity_id, insight.entity_id!)"
                />
                <div class="flex items-center justify-between text-xs text-muted">
                  <span>Cmd/Ctrl+Enter to post</span>
                  <UiButton
                    size="sm"
                    :disabled="!(rowDrafts[insight.entity_id!] || '').trim()"
                    :loading="!!rowPosting[insight.entity_id!]"
                    @click="postCommentOn(insight.entity_id, insight.entity_id!)"
                  >{{ rowPosting[insight.entity_id!] ? 'Posting…' : 'Post' }}</UiButton>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="openQuestions.length" class="space-y-2">
          <div class="flex items-center gap-2">
            <QuestionMarkCircleIcon class="size-5 text-muted" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-text-strong">Open questions</h2>
            <span class="text-xs text-muted">{{ openQuestions.length }}</span>
          </div>
          <ul class="divide-y divide-border-subtle">
            <template v-for="question in openQuestions" :key="question.id">
              <li class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-2" :class="isQuestionResolved(question.status) && 'opacity-70'">
                <button
                  type="button"
                  :class="[
                    'inline-flex size-5 items-center justify-center rounded border transition-colors',
                    isQuestionResolved(question.status)
                      ? 'border-success bg-success text-white'
                      : 'border-border-strong text-transparent hover:border-success'
                  ]"
                  :aria-pressed="isQuestionResolved(question.status)"
                  :aria-label="isQuestionResolved(question.status) ? 'Mark question as open' : 'Mark question as resolved'"
                  @click="toggleQuestion(question)"
                >
                  <CheckIcon v-if="isQuestionResolved(question.status)" class="size-3" aria-hidden="true" />
                </button>
                <span class="min-w-0 truncate text-sm text-text" :class="isQuestionResolved(question.status) && 'line-through text-muted'">{{ question.title }}</span>
                <button
                  v-if="question.entity_id"
                  type="button"
                  :class="[
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-3 hover:text-text',
                    isThreadOpen(question.entity_id) && 'bg-surface-3 text-text',
                    commentsFor(question.entity_id).length && 'text-accent'
                  ]"
                  :title="commentsFor(question.entity_id).length ? `${commentsFor(question.entity_id).length} comments` : 'Add comment'"
                  @click="toggleThread(question.entity_id)"
                >
                  <ChatBubbleLeftIcon class="size-3.5" aria-hidden="true" />
                  <span v-if="commentsFor(question.entity_id).length">{{ commentsFor(question.entity_id).length }}</span>
                </button>
              </li>
              <li v-if="isThreadOpen(question.entity_id)" class="ml-8 space-y-2 border-l-2 border-border-subtle py-2 pl-4">
                <div v-for="c in commentsFor(question.entity_id)" :key="c.id" class="rounded-md bg-surface-2 p-2 text-sm">
                  <div class="whitespace-pre-wrap text-text">{{ c.body }}</div>
                  <div class="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{{ formatDate(c.created_at) }}</span>
                    <button type="button" class="inline-flex size-6 items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger" title="Delete comment" @click="deleteComment(c)">
                      <TrashIcon class="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <UiTextarea
                  v-model="rowDrafts[question.entity_id!]"
                  :rows="2"
                  placeholder="Add a thought…"
                  @keydown="handleRowCommentKey($event, question.entity_id, question.entity_id!)"
                />
                <div class="flex items-center justify-between text-xs text-muted">
                  <span>Cmd/Ctrl+Enter to post</span>
                  <UiButton
                    size="sm"
                    :disabled="!(rowDrafts[question.entity_id!] || '').trim()"
                    :loading="!!rowPosting[question.entity_id!]"
                    @click="postCommentOn(question.entity_id, question.entity_id!)"
                  >{{ rowPosting[question.entity_id!] ? 'Posting…' : 'Post' }}</UiButton>
                </div>
              </li>
            </template>
          </ul>
        </section>

        <section v-if="documentEntityId" class="space-y-3">
          <div class="flex items-center gap-2">
            <ChatBubbleLeftIcon class="size-5 text-muted" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-text-strong">Comments</h2>
            <span v-if="commentsFor(documentEntityId).length" class="text-xs text-muted">{{ commentsFor(documentEntityId).length }}</span>
          </div>

          <ul v-if="commentsFor(documentEntityId).length" class="space-y-2">
            <li v-for="comment in commentsFor(documentEntityId)" :key="comment.id" class="rounded-card bg-surface-2 p-3">
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

          <div class="space-y-2">
            <UiTextarea
              v-model="draftCommentBody"
              :rows="2"
              placeholder="Add a thought, idea, or question…"
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
        </section>

        <div class="border-t border-border-subtle pt-4">
          <details class="group" @toggle="originalTextOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-text-soft hover:text-text">
              <DocumentTextIcon class="size-4 text-muted" aria-hidden="true" />
              <span>{{ originalTextOpen ? 'Hide original text' : 'Show original text' }}</span>
            </summary>
            <pre class="mt-3 overflow-auto whitespace-pre-wrap rounded-card bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text">{{ document.raw_text }}</pre>
          </details>
        </div>
      </section>

      <aside class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <section class="space-y-2">
          <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
            <UsersIcon class="size-4 text-muted" aria-hidden="true" />
            <h3>People</h3>
            <span class="text-xs font-normal text-muted">{{ people.length }}</span>
            <div class="ml-auto">
              <EntityPicker
                type="person"
                :exclude-ids="people.map((p) => p.id)"
                @select="(payload) => attachEntity('person', payload)"
              />
            </div>
          </div>
          <ul v-if="people.length" class="space-y-0.5">
            <li
              v-for="person in people"
              :key="person.id"
              class="group flex items-center gap-2"
            >
              <NuxtLink
                :to="`${ENTITY_DETAIL_BASE.person}/${person.id}`"
                class="min-w-0 flex-1 truncate py-1 text-sm text-text transition-colors hover:text-accent"
              >{{ person.name }}</NuxtLink>
              <button
                type="button"
                class="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                :aria-label="`Remove ${person.name}`"
                :title="`Remove ${person.name} from this capture`"
                @click.stop.prevent="detachEntity('person', person)"
              >
                <XMarkIcon class="size-3.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-muted">No people attached yet.</p>
        </section>

        <section class="space-y-2">
          <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
            <FolderIcon class="size-4 text-muted" aria-hidden="true" />
            <h3>Projects</h3>
            <span class="text-xs font-normal text-muted">{{ projects.length }}</span>
            <div class="ml-auto">
              <EntityPicker
                type="project"
                :exclude-ids="projects.map((p) => p.id)"
                @select="(payload) => attachEntity('project', payload)"
              />
            </div>
          </div>
          <ul v-if="projects.length" class="space-y-0.5">
            <li
              v-for="project in projects"
              :key="project.id"
              class="group flex items-center gap-2"
            >
              <NuxtLink
                :to="`${ENTITY_DETAIL_BASE.project}/${project.id}`"
                class="min-w-0 flex-1 truncate py-1 text-sm text-text transition-colors hover:text-accent"
              >{{ project.name }}</NuxtLink>
              <button
                type="button"
                class="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                :aria-label="`Remove ${project.name}`"
                :title="`Remove ${project.name} from this capture`"
                @click.stop.prevent="detachEntity('project', project)"
              >
                <XMarkIcon class="size-3.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-muted">No projects attached yet.</p>
        </section>

        <section class="space-y-2">
          <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
            <HashtagIcon class="size-4 text-muted" aria-hidden="true" />
            <h3>Tags</h3>
            <span class="text-xs font-normal text-muted">{{ tags.length }}</span>
            <div class="ml-auto">
              <EntityPicker
                type="tag"
                :exclude-ids="tags.map((t) => t.id)"
                @select="(payload) => attachEntity('tag', payload)"
              />
            </div>
          </div>
          <div v-if="tags.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="t in tags"
              :key="t.id"
              class="group inline-flex items-center rounded-full bg-soft pl-2.5 pr-1 py-0.5 text-xs font-medium text-text-soft"
            >
              <NuxtLink
                :to="`${ENTITY_DETAIL_BASE.tag}/${t.id}`"
                class="hover:text-accent"
              >#{{ t.name }}</NuxtLink>
              <button
                type="button"
                class="ml-1 inline-flex size-4 items-center justify-center rounded-full text-muted-soft opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                :aria-label="`Remove ${t.name}`"
                @click.stop.prevent="detachEntity('tag', t)"
              >
                <XMarkIcon class="size-3" aria-hidden="true" />
              </button>
            </span>
          </div>
          <p v-else class="text-xs text-muted">No tags attached yet.</p>
        </section>
      </aside>
    </main>
  </div>
</template>
