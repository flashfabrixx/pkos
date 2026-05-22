<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  HashtagIcon,
  SparklesIcon,
  TrashIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

type Kind = 'person' | 'project' | 'tag'

interface EntityBase {
  id: string
  name: string
  metadata: Record<string, unknown>
  summary?: string | null
  summary_state?: 'absent' | 'fresh' | 'stale' | 'generating' | 'failed' | null
  summary_updated_at?: string | null
}

interface RelatedRow {
  id: string
  type: string
  name: string
  co_mentions: number
}

interface CommentRow {
  id: string
  entity_id: string
  body: string
  document_id: string | null
  created_at: string
  updated_at: string
}

interface ActivityRow {
  id: string
  kind: string
  payload: Record<string, any>
  occurred_at: string
  source_document_id: string | null
  source_document_title: string | null
}

interface Stats {
  document_count?: number
  actions_open?: number
  actions_done?: number
  last_seen?: string | null
}

const props = defineProps<{
  entity: EntityBase
  kind: Kind
  eyebrow: string
  endpoint: string
  stats: Stats
  related: { people: RelatedRow[], projects: RelatedRow[], tags: RelatedRow[] }
  comments: CommentRow[]
  activities?: ActivityRow[]
}>()

const emit = defineEmits<{
  (e: 'update:entity'): void
  (e: 'update:comments', value: CommentRow[]): void
}>()

const namePrefix = computed(() => (props.kind === 'tag' ? '#' : ''))
const description = computed(() => {
  const value = (props.entity?.metadata as any)?.description
  return typeof value === 'string' ? value : ''
})
const descriptionPlaceholder = computed(() => `Add a description for this ${props.kind}…`)
const commentPlaceholder = computed(() => `Add a thought about this ${props.kind}…`)
const peopleHeading = computed(() => (props.kind === 'person' ? 'Related people' : 'People'))
const projectsHeading = computed(() => (props.kind === 'project' ? 'Related projects' : 'Projects'))
const tagsHeading = computed(() => (props.kind === 'tag' ? 'Related tags' : 'Tags'))

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return ''
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  if (Number.isNaN(then)) return ''
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatBrowserDate(value, '')
}

// ---------- Name editing ----------
const editingName = ref(false)
const draftName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function beginEditName() {
  draftName.value = props.entity.name
  editingName.value = true
  void nextTick(() => nameInputRef.value?.focus())
}
function cancelEditName() {
  editingName.value = false
  draftName.value = ''
}
async function commitEditName() {
  const next = draftName.value.trim()
  if (!next || next === props.entity.name) {
    cancelEditName()
    return
  }
  try {
    await $fetch(`${props.endpoint}/${props.entity.id}`, { method: 'PATCH', body: { name: next } })
    emit('update:entity')
  } catch (error) {
    console.error('Failed to rename entity', error)
  }
  cancelEditName()
}

// ---------- Description editing ----------
const editingDescription = ref(false)
const draftDescription = ref('')
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null)

function beginEditDescription() {
  draftDescription.value = description.value || ''
  editingDescription.value = true
  void nextTick(() => descriptionInputRef.value?.focus())
}
function cancelEditDescription() {
  editingDescription.value = false
  draftDescription.value = ''
}
async function commitEditDescription() {
  const next = draftDescription.value.trim()
  if (next === description.value) {
    cancelEditDescription()
    return
  }
  try {
    await $fetch(`${props.endpoint}/${props.entity.id}`, {
      method: 'PATCH',
      body: { description: next || null }
    })
    emit('update:entity')
  } catch (error) {
    console.error('Failed to update description', error)
  }
  cancelEditDescription()
}

// ---------- Summary ----------
const summary = computed(() => props.entity.summary || null)
const summaryState = computed(() => props.entity.summary_state || 'absent')
const summaryUpdatedAt = computed(() => props.entity.summary_updated_at || null)
const summaryWorking = ref(false)

async function refreshSummary() {
  if (summaryWorking.value) return
  summaryWorking.value = true
  try {
    await $fetch(`/api/entities/${props.entity.id}/summarize`, { method: 'POST' })
    emit('update:entity')
  } catch (error) {
    console.error('Failed to refresh summary', error)
  } finally {
    summaryWorking.value = false
  }
}

// ---------- Comments / Activity tabs ----------
const activityTab = ref<'comments' | 'activity'>('comments')
const activities = computed<ActivityRow[]>(() => props.activities || [])

const draftCommentBody = ref('')
const postingComment = ref(false)

async function postComment() {
  if (postingComment.value) return
  const body = draftCommentBody.value.trim()
  if (!body) return
  postingComment.value = true
  try {
    const result = await $fetch<{ comment: CommentRow }>('/api/comments', {
      method: 'POST',
      body: { entityId: props.entity.id, body }
    })
    emit('update:comments', [...props.comments, result.comment])
    emit('update:entity')
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
    emit('update:comments', props.comments.filter((c) => c.id !== comment.id))
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase()
}

const indexRoute = computed(() => {
  if (props.kind === 'person') return '/people'
  if (props.kind === 'project') return '/projects'
  return '/tags'
})

const deleting = ref(false)
const copying = ref(false)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const briefingLoading = ref(false)

async function startBriefingThread() {
  if (briefingLoading.value) return
  briefingLoading.value = true
  try {
    // Server-side compiles the entity export, creates the thread,
    // seeds the user prompt and runs a single LLM call. Wait for the
    // response (5-15s with Opus) and then jump straight into the
    // thread - follow-up turns happen in the standard streaming UI.
    const r = await $fetch<{ threadId: string }>('/api/threads/briefings', {
      method: 'POST',
      body: { entityId: props.entity.id, kind: 'briefing' }
    })
    await navigateTo(`/threads/${r.threadId}`)
  } catch (error) {
    console.error('Failed to start briefing thread', error)
    briefingLoading.value = false
  }
}

async function copyForChat() {
  if (copying.value) return
  copying.value = true
  copyState.value = 'idle'
  try {
    const result = await $fetch<{ markdown: string }>(`/api/entities/${props.entity.id}/export`)
    const markdown = result?.markdown || ''
    if (!markdown) {
      copyState.value = 'failed'
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown)
      copyState.value = 'copied'
    } else {
      // Older browsers / non-secure contexts: drop into a textarea and
      // execCommand('copy'). Best-effort fallback.
      const ta = document.createElement('textarea')
      ta.value = markdown
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      copyState.value = ok ? 'copied' : 'failed'
    }
  } catch (error) {
    console.error('Failed to copy entity export', error)
    copyState.value = 'failed'
  } finally {
    copying.value = false
    if (copyState.value === 'copied') {
      window.setTimeout(() => { copyState.value = 'idle' }, 2400)
    }
  }
}

async function deleteEntity() {
  if (deleting.value) return
  const label = `${namePrefix.value}${props.entity.name}`
  const confirmed = window.confirm(
    `Delete ${props.kind} "${label}"?\n\nThis will remove the entity, all its comments and its graph connections. Action items currently assigned to this ${props.kind} will be kept but lose the link.`
  )
  if (!confirmed) return
  deleting.value = true
  try {
    await $fetch(`/api/entities/${props.entity.id}`, { method: 'DELETE' })
    await navigateTo(indexRoute.value)
  } catch (error) {
    console.error('Failed to delete entity', error)
    deleting.value = false
  }
}

const ACTIVITY_LABEL: Record<string, (a: ActivityRow) => string> = {
  created: () => 'was created',
  mentioned_in_document: (a) => `mentioned in ${a.source_document_title || 'a document'}`,
  assigned_to_action: (a) => `assigned to "${a.payload?.action_title || 'an action'}"`,
  unassigned_from_action: (a) => `unassigned from "${a.payload?.action_title || 'an action'}"`,
  linked_to_project: () => 'linked to a project',
  unlinked_from_project: () => 'unlinked from a project',
  renamed: (a) => `renamed from "${a.payload?.from}" to "${a.payload?.to}"`,
  description_updated: () => 'description updated',
  commented: () => 'received a comment',
  merged_into: () => 'merged into another entity',
  received_merge_from: (a) => `merged with ${(a.payload?.merged?.length || 0)} duplicate(s)`
}

function activityLabel(a: ActivityRow): string {
  const fn = ACTIVITY_LABEL[a.kind]
  return fn ? fn(a) : a.kind
}
</script>

<template>
  <main class="mx-auto grid max-w-[1280px] gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section class="space-y-6 rounded-card border border-border-default bg-surface-1 p-6 shadow-card">
      <header class="space-y-3">
        <div class="flex items-start gap-3">
          <slot name="avatar" />
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ eyebrow }}</p>
            <button
              v-if="!editingName"
              type="button"
              class="-mx-2 mt-1 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-3"
              @click="beginEditName"
            >
              <h1 class="text-2xl font-semibold tracking-tight text-text-strong">{{ namePrefix }}{{ entity.name }}</h1>
            </button>
            <input
              v-else
              ref="nameInputRef"
              v-model="draftName"
              class="mt-1 w-full rounded-md border border-accent bg-surface-1 px-2 py-1 text-2xl font-semibold tracking-tight text-text-strong outline-none focus:ring-2 focus:ring-accent/20"
              type="text"
              maxlength="200"
              @blur="commitEditName"
              @keydown.enter.prevent="commitEditName"
              @keydown.esc.prevent="cancelEditName"
            >
          </div>
          <Menu as="div" class="relative shrink-0">
            <MenuButton
              class="inline-flex size-9 items-center justify-center rounded-md text-text-soft transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              :aria-label="`More actions for ${entity.name}`"
            >
              <EllipsisHorizontalIcon class="size-5" aria-hidden="true" />
            </MenuButton>
            <MenuItems class="absolute right-0 z-30 mt-1 w-56 origin-top-right rounded-md border border-border-default bg-surface-1 py-1 text-sm shadow-popover focus:outline-none">
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    active ? 'bg-accent-soft text-accent' : 'text-text',
                    summaryWorking && 'cursor-not-allowed opacity-60'
                  ]"
                  :disabled="summaryWorking"
                  @click="refreshSummary"
                >
                  <SparklesIcon class="size-4" aria-hidden="true" />
                  <span>{{ summaryWorking ? 'Summarising…' : 'Refresh summary' }}</span>
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    active ? 'bg-accent-soft text-accent' : 'text-text',
                    briefingLoading && 'cursor-not-allowed opacity-60'
                  ]"
                  :disabled="briefingLoading"
                  :title="`Start a new thread with an Opus-generated briefing on this ${kind} as the first turn.`"
                  @click="startBriefingThread"
                >
                  <ChatBubbleLeftRightIcon class="size-4" aria-hidden="true" />
                  <span>{{ briefingLoading ? 'Generating briefing…' : 'Generate briefing thread' }}</span>
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    active ? 'bg-accent-soft text-accent' : 'text-text',
                    copying && 'cursor-not-allowed opacity-60'
                  ]"
                  :disabled="copying"
                  :title="`Copy a full Markdown briefing on this ${kind} to the clipboard so you can paste it into a chat workbench like Claude.`"
                  @click="copyForChat"
                >
                  <ClipboardDocumentIcon class="size-4" aria-hidden="true" />
                  <span>
                    <template v-if="copyState === 'copied'">Copied to clipboard</template>
                    <template v-else-if="copyState === 'failed'">Copy failed</template>
                    <template v-else>{{ copying ? 'Preparing…' : 'Copy as Markdown' }}</template>
                  </span>
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    active ? 'bg-danger-soft text-danger' : 'text-danger',
                    deleting && 'cursor-not-allowed opacity-60'
                  ]"
                  :disabled="deleting"
                  @click="deleteEntity"
                >
                  <TrashIcon class="size-4" aria-hidden="true" />
                  <span>{{ deleting ? 'Deleting…' : `Delete ${kind}` }}</span>
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-xs text-text-soft">
          <span v-if="stats.document_count" class="inline-flex items-center gap-1.5">
            <DocumentTextIcon class="size-4" aria-hidden="true" />
            <span>{{ stats.document_count }} {{ stats.document_count === 1 ? 'document' : 'documents' }}</span>
          </span>
          <span v-if="stats.actions_open || stats.actions_done" class="inline-flex items-center gap-1.5">
            <ClipboardDocumentCheckIcon class="size-4" aria-hidden="true" />
            <span>{{ stats.actions_open }} open · {{ stats.actions_done }} done</span>
          </span>
          <span v-if="stats.last_seen" class="inline-flex items-center gap-1.5">
            <CalendarDaysIcon class="size-4" aria-hidden="true" />
            <span>Last seen {{ formatDate(stats.last_seen) }}</span>
          </span>
        </div>
      </header>

      <section v-if="summary || summaryState !== 'absent'" class="space-y-2 rounded-card border border-border-subtle bg-surface-2 p-4">
        <div class="flex items-center gap-2">
          <SparklesIcon class="size-5 text-warning" aria-hidden="true" />
          <h2 class="text-sm font-semibold text-text-strong">Summary</h2>
          <UiBadge v-if="summaryState === 'stale'" variant="warning">stale</UiBadge>
          <UiBadge v-if="summaryState === 'generating'" variant="accent">refreshing…</UiBadge>
          <UiBadge v-if="summaryState === 'failed'" variant="danger">failed</UiBadge>
          <button
            v-if="summaryState !== 'generating'"
            type="button"
            class="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-text-soft transition-colors hover:bg-surface-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="summaryWorking"
            @click="refreshSummary"
          >
            <ArrowPathIcon class="size-3.5" :class="summaryWorking && 'animate-spin'" aria-hidden="true" />
            <span>{{ summary ? 'Refresh' : 'Generate' }}</span>
          </button>
        </div>
        <p v-if="summary" class="text-sm leading-relaxed text-text">{{ summary }}</p>
        <p v-else class="text-sm text-muted">No summary yet — click Generate to build one from the captured context.</p>
        <p v-if="summaryUpdatedAt" class="text-xs text-muted">Updated {{ relativeTime(summaryUpdatedAt) }}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-text-strong">Description</h2>
        <button
          v-if="!editingDescription"
          type="button"
          class="-mx-2 block w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-3"
          @click="beginEditDescription"
        >
          <p v-if="description" class="text-sm leading-relaxed text-text">{{ description }}</p>
          <p v-else class="text-sm text-muted">{{ descriptionPlaceholder }}</p>
        </button>
        <textarea
          v-else
          ref="descriptionInputRef"
          v-model="draftDescription"
          class="block w-full resize-vertical rounded-md border border-accent bg-surface-1 p-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/20"
          rows="3"
          placeholder="Add a description…"
          @blur="commitEditDescription"
          @keydown.esc.prevent="cancelEditDescription"
          @keydown.meta.enter.prevent="commitEditDescription"
          @keydown.ctrl.enter.prevent="commitEditDescription"
        />
      </section>

      <slot name="sections" />

      <section class="space-y-3">
        <div class="flex items-center gap-1 border-b border-border-subtle">
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activityTab === 'comments'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-soft hover:text-text'
            ]"
            @click="activityTab = 'comments'"
          >
            <ChatBubbleLeftIcon class="size-4" aria-hidden="true" />
            <span>Comments</span>
            <span v-if="comments.length" class="text-xs text-muted">{{ comments.length }}</span>
          </button>
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activityTab === 'activity'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-soft hover:text-text'
            ]"
            @click="activityTab = 'activity'"
          >
            <ClockIcon class="size-4" aria-hidden="true" />
            <span>Activity</span>
            <span v-if="activities.length" class="text-xs text-muted">{{ activities.length }}</span>
          </button>
        </div>

        <div v-if="activityTab === 'comments'" class="space-y-3">
          <ul v-if="comments.length" class="space-y-3">
            <li v-for="comment in comments" :key="comment.id" class="rounded-card border border-border-subtle bg-surface-2 p-3">
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
              :placeholder="commentPlaceholder"
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
        </div>

        <div v-else>
          <ol v-if="activities.length" class="space-y-3">
            <li v-for="activity in activities" :key="activity.id" class="flex items-start gap-3">
              <span class="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-text">{{ activityLabel(activity) }}</p>
                <p class="text-xs text-muted">
                  <span>{{ relativeTime(activity.occurred_at) }}</span>
                  <NuxtLink
                    v-if="activity.source_document_id"
                    :to="`/documents/${activity.source_document_id}`"
                    class="text-accent hover:underline"
                  >· {{ activity.source_document_title }}</NuxtLink>
                </p>
              </div>
            </li>
          </ol>
          <p v-else class="text-sm text-muted">No activity recorded yet.</p>
        </div>
      </section>
    </section>

    <aside class="space-y-6 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <section v-if="related.people.length" class="space-y-2">
        <div class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <UsersIcon class="size-4 text-muted" aria-hidden="true" />
          <h3>{{ peopleHeading }}</h3>
          <span class="text-xs font-normal text-muted">{{ related.people.length }}</span>
        </div>
        <ul class="space-y-1">
          <li v-for="p in related.people" :key="p.id">
            <NuxtLink :to="`/people/${p.id}`" class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2">
              <span
                class="inline-flex size-6 items-center justify-center rounded-full text-xs font-bold"
                :style="{ background: colorFor(p.name).bg, color: colorFor(p.name).fg }"
              >{{ initialsOf(p.name) }}</span>
              <span class="truncate text-sm text-text">{{ p.name }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="related.projects.length" class="space-y-2">
        <div class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <FolderIcon class="size-4 text-muted" aria-hidden="true" />
          <h3>{{ projectsHeading }}</h3>
        </div>
        <ul class="space-y-1">
          <li v-for="p in related.projects" :key="p.id">
            <NuxtLink :to="`/projects/${p.id}`" class="block rounded-md px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface-2">{{ p.name }}</NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="related.tags.length" class="space-y-2">
        <div class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <HashtagIcon class="size-4 text-muted" aria-hidden="true" />
          <h3>{{ tagsHeading }}</h3>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <NuxtLink
            v-for="t in related.tags"
            :key="t.id"
            :to="`/tags/${t.id}`"
            class="inline-flex items-center rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-text-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >#{{ t.name }}</NuxtLink>
        </div>
      </section>

      <EntitySuggestions
        v-if="entity?.id"
        :entity-id="entity.id"
        :entity-type="kind"
      />
    </aside>
  </main>
</template>
