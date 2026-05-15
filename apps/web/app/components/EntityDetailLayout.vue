<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentCheckIcon,
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

// ---------- Activity helpers ----------
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
  <div>
    <main class="workspace document-grid">
      <section class="panel document-main">
        <header class="doc-header">
          <div class="doc-header-title entity-header">
            <slot name="avatar" />
            <div class="entity-header-text">
              <button
                v-if="!editingName"
                type="button"
                class="doc-row-edit-trigger entity-name-trigger"
                @click="beginEditName"
              >
                <h1>{{ namePrefix }}{{ entity.name }}</h1>
              </button>
              <input
                v-else
                ref="nameInputRef"
                v-model="draftName"
                class="doc-row-edit-input entity-name-input"
                type="text"
                maxlength="200"
                @blur="commitEditName"
                @keydown.enter.prevent="commitEditName"
                @keydown.esc.prevent="cancelEditName"
              >
              <p class="entity-eyebrow">{{ eyebrow }}</p>
            </div>
            <Menu as="div" class="entity-menu">
              <MenuButton class="entity-menu-trigger" :aria-label="`More actions for ${entity.name}`">
                <EllipsisHorizontalIcon class="size-5" aria-hidden="true" />
              </MenuButton>
              <MenuItems class="entity-menu-items">
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="entity-menu-item"
                    :class="{ 'is-active': active }"
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
                    class="entity-menu-item entity-menu-item--danger"
                    :class="{ 'is-active': active }"
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

          <div class="document-meta">
            <span v-if="stats.document_count">
              <DocumentTextIcon class="size-4" aria-hidden="true" />
              <span>{{ stats.document_count }} {{ stats.document_count === 1 ? 'document' : 'documents' }}</span>
            </span>
            <span v-if="stats.actions_open || stats.actions_done">
              <ClipboardDocumentCheckIcon class="size-4" aria-hidden="true" />
              <span>{{ stats.actions_open }} open · {{ stats.actions_done }} done</span>
            </span>
            <span v-if="stats.last_seen">
              <CalendarDaysIcon class="size-4" aria-hidden="true" />
              <span>Last seen {{ formatDate(stats.last_seen) }}</span>
            </span>
          </div>
        </header>

        <section v-if="summary || summaryState !== 'absent'" class="doc-section entity-summary-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <SparklesIcon class="size-5 text-amber-500" aria-hidden="true" />
              <h2>Summary</h2>
              <span v-if="summaryState === 'stale'" class="entity-summary-badge entity-summary-badge--stale">stale</span>
              <span v-if="summaryState === 'generating'" class="entity-summary-badge entity-summary-badge--working">refreshing…</span>
              <span v-if="summaryState === 'failed'" class="entity-summary-badge entity-summary-badge--failed">failed</span>
            </div>
            <button
              v-if="summaryState !== 'generating'"
              type="button"
              class="entity-summary-refresh"
              :disabled="summaryWorking"
              @click="refreshSummary"
            >
              <ArrowPathIcon class="size-3.5" :class="{ 'animate-spin': summaryWorking }" aria-hidden="true" />
              <span>{{ summary ? 'Refresh' : 'Generate' }}</span>
            </button>
          </div>
          <p v-if="summary" class="entity-summary-text">{{ summary }}</p>
          <p v-else class="muted entity-summary-empty">No summary yet — click Generate to build one from the captured context.</p>
          <p v-if="summaryUpdatedAt" class="entity-summary-meta">Updated {{ relativeTime(summaryUpdatedAt) }}</p>
        </section>

        <section class="doc-section">
          <div class="doc-section-head">
            <div class="doc-section-title">
              <h2>Description</h2>
            </div>
          </div>
          <button
            v-if="!editingDescription"
            type="button"
            class="doc-row-edit-trigger entity-description-trigger"
            @click="beginEditDescription"
          >
            <p v-if="description" class="entity-description">{{ description }}</p>
            <p v-else class="muted">{{ descriptionPlaceholder }}</p>
          </button>
          <textarea
            v-else
            ref="descriptionInputRef"
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

        <slot name="sections" />

        <section class="doc-section">
          <div class="entity-tabs">
            <button
              type="button"
              class="entity-tab"
              :class="{ 'is-active': activityTab === 'comments' }"
              @click="activityTab = 'comments'"
            >
              <ChatBubbleLeftIcon class="size-4" aria-hidden="true" />
              <span>Comments</span>
              <span v-if="comments.length" class="count">{{ comments.length }}</span>
            </button>
            <button
              type="button"
              class="entity-tab"
              :class="{ 'is-active': activityTab === 'activity' }"
              @click="activityTab = 'activity'"
            >
              <ClockIcon class="size-4" aria-hidden="true" />
              <span>Activity</span>
              <span v-if="activities.length" class="count">{{ activities.length }}</span>
            </button>
          </div>

          <div v-if="activityTab === 'comments'">
            <ul v-if="comments.length" class="doc-comment-list">
              <li v-for="comment in comments" :key="comment.id" class="doc-comment">
                <div class="doc-comment-body">{{ comment.body }}</div>
                <div class="doc-comment-meta">
                  <span>{{ formatDate(comment.created_at) }}</span>
                  <button
                    type="button"
                    class="doc-comment-delete"
                    title="Delete comment"
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
                :placeholder="commentPlaceholder"
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
          </div>

          <div v-else class="entity-activity-feed">
            <ol v-if="activities.length" class="entity-activity-list">
              <li v-for="activity in activities" :key="activity.id" class="entity-activity-row">
                <span class="entity-activity-dot" aria-hidden="true"></span>
                <div class="entity-activity-body">
                  <p class="entity-activity-text">{{ activityLabel(activity) }}</p>
                  <p class="entity-activity-meta">
                    <span>{{ relativeTime(activity.occurred_at) }}</span>
                    <NuxtLink
                      v-if="activity.source_document_id"
                      :to="`/documents/${activity.source_document_id}`"
                      class="entity-activity-source"
                    >· {{ activity.source_document_title }}</NuxtLink>
                  </p>
                </div>
              </li>
            </ol>
            <p v-else class="muted">No activity recorded yet.</p>
          </div>
        </section>
      </section>

      <aside class="panel side-panel side-panel--flat">
        <section v-if="related.people.length" class="side-section">
          <div class="side-section-head">
            <UsersIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>{{ peopleHeading }}</h3>
            <span class="count">{{ related.people.length }}</span>
          </div>
          <ul class="people-list">
            <li v-for="p in related.people" :key="p.id">
              <NuxtLink :to="`/people/${p.id}`" class="entity-link">
                <span
                  class="avatar"
                  :style="{ background: colorFor(p.name).bg, color: colorFor(p.name).fg }"
                >{{ initialsOf(p.name) }}</span>
                <span class="person-name">{{ p.name }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="related.projects.length" class="side-section">
          <div class="side-section-head">
            <FolderIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>{{ projectsHeading }}</h3>
          </div>
          <ul class="project-list">
            <li v-for="p in related.projects" :key="p.id">
              <NuxtLink :to="`/projects/${p.id}`" class="entity-link">{{ p.name }}</NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="related.tags.length" class="side-section">
          <div class="side-section-head">
            <HashtagIcon class="size-4 text-slate-500" aria-hidden="true" />
            <h3>{{ tagsHeading }}</h3>
          </div>
          <div class="tag-list">
            <NuxtLink
              v-for="t in related.tags"
              :key="t.id"
              :to="`/tags/${t.id}`"
              class="tag"
            >#{{ t.name }}</NuxtLink>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
