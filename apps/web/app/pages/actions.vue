<script setup lang="ts">
import type { ActionItem, ActionStatus } from '@bkos/core'
import { AdjustmentsHorizontalIcon, CalendarDaysIcon, CheckCircleIcon, ChevronRightIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { sourceTypeIcon } from '~/utils/source-type'
import { colorFor } from '~/utils/hash-color'
import { useSessionState } from '~/composables/useSessionState'
import { useInfiniteList } from '~/composables/useInfiniteList'

const { t } = useI18n()
useHead({ title: () => t('actions.title') })

type ActionFilterStatus = ActionStatus | 'all'
type EditableField = 'title' | 'dueDate' | null

const DEFAULT_STATUS: ActionFilterStatus = 'open'
const DEFAULT_PROJECT = 'all'

const status = useSessionState<ActionFilterStatus>('bkos:actions:status', DEFAULT_STATUS)
const project = useSessionState<string>('bkos:actions:project', DEFAULT_PROJECT)
const filterPanelOpen = ref(false)
const filterRoot = ref<HTMLElement | null>(null)
const editingActionId = ref<string | null>(null)
const draftTitle = ref('')
const draftDueDate = ref('')
const titleInput = ref<HTMLInputElement | null>(null)
const dueDateInput = ref<HTMLInputElement | null>(null)

const statusOptions: Array<{ value: ActionFilterStatus, label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'dismissed', label: 'Dismissed' }
]

const projectsForFilter = ref<Array<{ id: string, name: string }>>([])
const {
  items: actions,
  loading: pending,
  loadingMore,
  hasMore,
  reset: refresh,
  sentinelRef
} = useInfiniteList<ActionItem>({
  pageSize: 50,
  watch: [status, project],
  async fetcher({ offset, limit }) {
    const data = await $fetch<{
      actions: ActionItem[]
      projects: Array<{ id: string, name: string }>
      hasMore: boolean
    }>('/api/actions', { query: { status: status.value, project: project.value, offset, limit } })
    if (offset === 0) projectsForFilter.value = data.projects || []
    return { items: data.actions, hasMore: data.hasMore }
  }
})

const projectOptions = computed(() => [
  { value: 'all', label: 'All projects' },
  ...projectsForFilter.value.map((item) => ({ value: item.id, label: item.name }))
])
const actionById = computed(() => new Map(actions.value.map((action) => [action.id, action])))

const TODAY_ISO = new Date().toISOString().slice(0, 10)

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}

function isOverdue(action: ActionItem) {
  if (!action.due_date || action.status === 'done' || action.status === 'dismissed') return false
  return String(action.due_date).slice(0, 10) < TODAY_ISO
}

function isToday(action: ActionItem) {
  if (!action.due_date) return false
  return String(action.due_date).slice(0, 10) === TODAY_ISO
}

function isEditing(action: ActionItem) {
  return editingActionId.value === action.id
}

function beginEdit(action: ActionItem, field: Exclude<EditableField, null>) {
  editingActionId.value = action.id
  draftTitle.value = action.title
  draftDueDate.value = action.due_date || ''
  void nextTick(() => {
    if (field === 'dueDate') {
      const el = dueDateInput.value
      el?.focus()
      try { (el as unknown as { showPicker?: () => void })?.showPicker?.() } catch {}
      return
    }
    titleInput.value?.focus()
  })
}

function cancelEdit() {
  editingActionId.value = null
  draftTitle.value = ''
  draftDueDate.value = ''
}

async function updateAction(id: string, nextStatus: ActionStatus) {
  await $fetch(`/api/actions/${id}`, {
    method: 'PATCH',
    body: { status: nextStatus }
  })
  await refresh()
}

async function saveEdit(action: ActionItem) {
  if (editingActionId.value !== action.id) return

  const payload: Record<string, string | null> = {}
  const nextTitle = draftTitle.value.trim()
  const nextDueDate = draftDueDate.value || null

  if (nextTitle && nextTitle !== action.title) payload.title = nextTitle
  if (nextDueDate !== action.due_date) payload.dueDate = nextDueDate

  if (!Object.keys(payload).length) {
    cancelEdit()
    return
  }

  await $fetch(`/api/actions/${action.id}`, {
    method: 'PATCH',
    body: payload
  })
  await refresh()
  cancelEdit()
}

async function handleRowFocusOut(action: ActionItem, event: FocusEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const relatedTarget = event.relatedTarget as Node | null
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) return
  await saveEdit(action)
}

async function deleteAction(id: string) {
  await $fetch(`/api/actions/${id}`, { method: 'DELETE' })
  await refresh()
}

function markDoneLabel(action: ActionItem) {
  return action.status === 'done' ? 'Mark open' : 'Mark done'
}

function openInlineEditor(action: ActionItem, field: Exclude<EditableField, null>) {
  if (editingActionId.value && editingActionId.value !== action.id) {
    const current = actionById.value.get(editingActionId.value)
    if (current) void saveEdit(current)
  }
  beginEdit(action, field)
}

async function patchAssignee(action: ActionItem, body: Record<string, string | null>) {
  await $fetch(`/api/actions/${action.id}`, { method: 'PATCH', body })
  await refresh()
}

function selectAssignee(action: ActionItem, person: { id: string, name: string }) {
  void patchAssignee(action, { personId: person.id })
}

function createAssignee(action: ActionItem, payload: { name: string }) {
  void patchAssignee(action, { personName: payload.name })
}

function clearAssignee(action: ActionItem) {
  void patchAssignee(action, { personId: null })
}

const router = useRouter()
const drawerActionId = computed<string | null>({
  get() {
    const value = useRoute().query.action
    return typeof value === 'string' ? value : null
  },
  set(value) {
    const route = useRoute()
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
async function handleDrawerDelete(_id: string) {
  await refresh()
}

function sourcePillFor(action: ActionItem) {
  const label = action.project_name || action.document_title || 'Source'
  const palette = colorFor(action.project_name || action.document_title)
  return { label, ...palette }
}

const statusLabel = computed(
  () => statusOptions.find((option) => option.value === status.value)?.label || 'All'
)
const projectLabel = computed(
  () => projectOptions.value.find((option) => option.value === project.value)?.label || 'All projects'
)
const hasActiveFilters = computed(
  () => status.value !== DEFAULT_STATUS || project.value !== DEFAULT_PROJECT
)

function clearStatus() { status.value = DEFAULT_STATUS }
function clearProject() { project.value = DEFAULT_PROJECT }
function clearAllFilters() {
  status.value = DEFAULT_STATUS
  project.value = DEFAULT_PROJECT
}

function toggleFilterPanel() {
  filterPanelOpen.value = !filterPanelOpen.value
}

function handleFilterClickOutside(event: MouseEvent) {
  if (!filterRoot.value || !filterPanelOpen.value) return
  if (!filterRoot.value.contains(event.target as Node)) filterPanelOpen.value = false
}

onMounted(() => {
  if (import.meta.client) document.addEventListener('mousedown', handleFilterClickOutside)
})
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('mousedown', handleFilterClickOutside)
})
</script>

<template>
  <div>
    <ActionDrawer
      v-model:action-id="drawerActionId"
      @updated="handleDrawerUpdate"
      @deleted="handleDrawerDelete"
    />
    <main class="mx-auto grid max-w-[1440px] gap-4 p-5">
      <section class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Act</p>
            <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('actions.title') }}</h1>
          </div>

          <div ref="filterRoot" class="relative">
            <button
              type="button"
              :class="[
                'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                hasActiveFilters
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-default bg-surface-1 text-text-soft hover:bg-surface-3'
              ]"
              :aria-expanded="filterPanelOpen"
              @click="toggleFilterPanel"
            >
              <AdjustmentsHorizontalIcon class="size-4" aria-hidden="true" />
              <span>Filter</span>
              <span v-if="hasActiveFilters" class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-accent-fg">
                {{ (status !== DEFAULT_STATUS ? 1 : 0) + (project !== DEFAULT_PROJECT ? 1 : 0) }}
              </span>
            </button>

            <div
              v-if="filterPanelOpen"
              class="absolute right-0 z-20 mt-2 w-72 rounded-card border border-border-default bg-surface-1 p-3 shadow-popover"
              role="dialog"
            >
              <div class="grid gap-3">
                <UiField label="Status">
                  <UiSelect v-model="status" :options="statusOptions" />
                </UiField>
                <UiField label="Project">
                  <UiSelect v-model="project" :options="projectOptions" />
                </UiField>
                <div v-if="hasActiveFilters" class="flex justify-end border-t border-border-subtle pt-3">
                  <UiButton variant="ghost" size="sm" @click="clearAllFilters">Reset filters</UiButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasActiveFilters" class="mb-3 flex flex-wrap items-center gap-2">
          <span v-if="status !== DEFAULT_STATUS" class="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-xs text-accent">
            <span class="font-semibold uppercase tracking-wider text-[10px] opacity-80">Status</span>
            <span class="font-medium">{{ statusLabel }}</span>
            <button type="button" class="inline-flex size-5 items-center justify-center rounded-full hover:bg-accent/15" aria-label="Clear status filter" @click="clearStatus">
              <XMarkIcon class="size-3" aria-hidden="true" />
            </button>
          </span>
          <span v-if="project !== DEFAULT_PROJECT" class="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-xs text-accent">
            <span class="font-semibold uppercase tracking-wider text-[10px] opacity-80">Project</span>
            <span class="font-medium">{{ projectLabel }}</span>
            <button type="button" class="inline-flex size-5 items-center justify-center rounded-full hover:bg-accent/15" aria-label="Clear project filter" @click="clearProject">
              <XMarkIcon class="size-3" aria-hidden="true" />
            </button>
          </span>
          <button type="button" class="text-xs font-semibold text-muted hover:text-accent" @click="clearAllFilters">Clear all</button>
        </div>

        <div class="overflow-hidden rounded-card border border-border-subtle">
          <div class="grid grid-cols-[40px_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <span></span>
            <span>Task</span>
            <span>Assignee</span>
            <span>Due date</span>
            <span>Source</span>
          </div>

          <div
            v-for="action in actions"
            :key="action.id"
            class="group grid grid-cols-[40px_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-border-subtle px-3 py-2 transition-colors last:border-0 hover:bg-surface-2"
            @focusout="handleRowFocusOut(action, $event)"
          >
            <button
              :class="[
                'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                action.status === 'done'
                  ? 'text-success hover:bg-success-soft'
                  : 'text-muted-soft hover:text-success hover:bg-success-soft'
              ]"
              type="button"
              :title="markDoneLabel(action)"
              @click="updateAction(action.id, action.status === 'done' ? 'open' : 'done')"
            >
              <CheckCircleIcon class="size-5" aria-hidden="true" />
            </button>

            <div class="flex min-w-0 items-center gap-2">
              <button
                v-if="!isEditing(action)"
                type="button"
                class="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm text-text hover:bg-surface-3"
                @click="openInlineEditor(action, 'title')"
              >
                <span :class="action.status === 'done' && 'text-muted line-through'">{{ action.title }}</span>
              </button>
              <input
                v-else
                ref="titleInput"
                v-model="draftTitle"
                class="min-w-0 flex-1 rounded-md border border-accent bg-surface-1 px-2 py-1 text-sm text-text outline-none focus:ring-2 focus:ring-accent/20"
                type="text"
                maxlength="500"
                @keydown.enter.prevent="saveEdit(action)"
                @keydown.esc.prevent="cancelEdit"
                @click.stop
              >
              <button
                v-if="!isEditing(action)"
                type="button"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-soft opacity-0 transition-opacity hover:bg-surface-3 hover:text-text group-hover:opacity-100"
                title="Open action detail"
                @click="openActionDrawer(action.id)"
              >
                <ChevronRightIcon class="size-4" aria-hidden="true" />
              </button>
              <button v-if="isEditing(action)" type="button" class="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-text" title="Cancel edit" @click="cancelEdit">
                <XMarkIcon class="size-4" aria-hidden="true" />
              </button>
              <button v-if="isEditing(action)" type="button" class="inline-flex size-7 items-center justify-center rounded-md text-success hover:bg-success-soft" title="Save edit" @click="saveEdit(action)">
                <CheckCircleIcon class="size-4" aria-hidden="true" />
              </button>
            </div>

            <div class="min-w-0">
              <AssigneePicker
                :person-id="action.person_id"
                :person-name="action.person_name"
                @select="(person) => selectAssignee(action, person)"
                @create="(payload) => createAssignee(action, payload)"
                @clear="clearAssignee(action)"
              />
            </div>

            <div class="min-w-0">
              <button
                v-if="!isEditing(action)"
                type="button"
                :class="[
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-surface-3',
                  isOverdue(action) && 'text-danger',
                  isToday(action) && !isOverdue(action) && 'text-warning',
                  !action.due_date && 'text-muted-soft'
                ]"
                :title="action.due_date ? formatDate(action.due_date) : 'Set due date'"
                @click="openInlineEditor(action, 'dueDate')"
              >
                <CalendarDaysIcon
                  v-if="!action.due_date"
                  class="size-4"
                  aria-hidden="true"
                />
                <span v-else>{{ isToday(action) ? 'Today' : formatDate(action.due_date) }}</span>
              </button>
              <input
                v-else
                ref="dueDateInput"
                v-model="draftDueDate"
                class="rounded-md border border-accent bg-surface-1 px-2 py-1 text-xs text-text outline-none focus:ring-2 focus:ring-accent/20"
                type="date"
                @keydown.enter.prevent="saveEdit(action)"
                @keydown.esc.prevent="cancelEdit"
                @click.stop
              >
            </div>

            <div class="min-w-0">
              <NuxtLink
                class="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                :to="`/documents/${action.document_id}`"
                :style="{ background: sourcePillFor(action).bg, color: sourcePillFor(action).fg }"
                :title="`${action.document_title} · ${action.document_source_type}`"
              >
                <component :is="sourceTypeIcon(action.document_source_type)" class="size-3.5 shrink-0" aria-hidden="true" />
                <span class="truncate">{{ sourcePillFor(action).label }}</span>
              </NuxtLink>
            </div>
          </div>

          <p v-if="pending" class="p-4 text-sm text-muted">Loading actions...</p>
          <p v-if="!pending && !actions.length" class="p-4 text-sm text-muted">No actions match these filters.</p>
        </div>

        <div ref="sentinelRef" class="py-4 text-center" aria-hidden="true">
          <span v-if="loadingMore" class="text-xs text-muted">Loading more…</span>
          <span v-else-if="!hasMore && actions.length" class="text-xs text-muted">End of list</span>
        </div>
      </section>
    </main>
  </div>
</template>
