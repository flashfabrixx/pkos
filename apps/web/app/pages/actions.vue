<script setup lang="ts">
import type { ActionItem, ActionStatus } from '@bkos/core'
import { AdjustmentsHorizontalIcon, CalendarDaysIcon, CheckCircleIcon, ChevronRightIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { sourceTypeIcon } from '~/utils/source-type'
import { colorFor } from '~/utils/hash-color'
import { useSessionState } from '~/composables/useSessionState'

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

const { data, refresh, pending } = await useFetch<{
  actions: ActionItem[]
  projects: Array<{ id: string, name: string }>
}>('/api/actions', {
  query: { status, project },
  watch: [status, project]
})

const actions = computed(() => data.value?.actions || [])
const projectOptions = computed(() => [
  { value: 'all', label: 'All projects' },
  ...(data.value?.projects || []).map((item) => ({ value: item.id, label: item.name }))
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
      // showPicker() forces the native calendar to open
      // (focus() alone doesn't trigger it in most browsers)
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
  await $fetch(`/api/actions/${id}`, {
    method: 'DELETE'
  })
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
async function handleDrawerDelete(id: string) {
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

function clearStatus() {
  status.value = DEFAULT_STATUS
}
function clearProject() {
  project.value = DEFAULT_PROJECT
}
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
      <section class="panel">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="eyebrow">Act</p>
            <h1>Action items</h1>
          </div>

          <div ref="filterRoot" class="filter-bar">
            <button
              type="button"
              class="filter-trigger"
              :class="{ 'is-active': hasActiveFilters }"
              :aria-expanded="filterPanelOpen"
              @click="toggleFilterPanel"
            >
              <AdjustmentsHorizontalIcon class="size-4" aria-hidden="true" />
              <span>Filter</span>
              <span v-if="hasActiveFilters" class="filter-trigger-count">
                {{ (status !== DEFAULT_STATUS ? 1 : 0) + (project !== DEFAULT_PROJECT ? 1 : 0) }}
              </span>
            </button>

            <div v-if="filterPanelOpen" class="filter-panel" role="dialog">
              <div class="filter-panel-row">
                <BkosSelect v-model="status" label="Status" :options="statusOptions" />
              </div>
              <div class="filter-panel-row">
                <BkosSelect v-model="project" label="Project" :options="projectOptions" />
              </div>
              <div v-if="hasActiveFilters" class="filter-panel-footer">
                <button type="button" class="filter-reset" @click="clearAllFilters">Reset filters</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasActiveFilters" class="filter-chips">
          <span v-if="status !== DEFAULT_STATUS" class="filter-chip">
            <span class="filter-chip-label">Status</span>
            <span>{{ statusLabel }}</span>
            <button type="button" class="filter-chip-remove" aria-label="Clear status filter" @click="clearStatus">
              <XMarkIcon class="size-3" aria-hidden="true" />
            </button>
          </span>
          <span v-if="project !== DEFAULT_PROJECT" class="filter-chip">
            <span class="filter-chip-label">Project</span>
            <span>{{ projectLabel }}</span>
            <button type="button" class="filter-chip-remove" aria-label="Clear project filter" @click="clearProject">
              <XMarkIcon class="size-3" aria-hidden="true" />
            </button>
          </span>
          <button type="button" class="filter-chip-clear-all" @click="clearAllFilters">Clear all</button>
        </div>

        <div class="asana-table">
          <div class="asana-header">
            <span></span>
            <span>Task</span>
            <span>Assignee</span>
            <span>Due date</span>
            <span>Source</span>
          </div>

          <div
            v-for="action in actions"
            :key="action.id"
            class="asana-row"
            @focusout="handleRowFocusOut(action, $event)"
          >
            <button
              :class="['action-check', action.status === 'done' ? 'is-done' : 'is-open']"
              type="button"
              :title="markDoneLabel(action)"
              @click="updateAction(action.id, action.status === 'done' ? 'open' : 'done')"
            >
              <CheckCircleIcon class="size-5" aria-hidden="true" />
            </button>

            <div class="asana-title">
              <button
                v-if="!isEditing(action)"
                class="asana-inline-trigger"
                type="button"
                @click="openInlineEditor(action, 'title')"
              >
                <span class="asana-title-text" :class="{ 'is-done': action.status === 'done' }">{{ action.title }}</span>
              </button>
              <input
                v-else
                ref="titleInput"
                v-model="draftTitle"
                class="asana-inline-input"
                type="text"
                maxlength="500"
                @keydown.enter.prevent="saveEdit(action)"
                @keydown.esc.prevent="cancelEdit"
                @click.stop
              >
              <button
                v-if="!isEditing(action)"
                type="button"
                class="row-open-chevron"
                title="Open action detail"
                @click="openActionDrawer(action.id)"
              >
                <ChevronRightIcon class="size-4" aria-hidden="true" />
              </button>
              <button v-if="isEditing(action)" class="action-inline-cancel" type="button" title="Cancel edit" @click="cancelEdit">
                <XMarkIcon class="size-4" aria-hidden="true" />
              </button>
              <button v-if="isEditing(action)" class="action-inline-save" type="button" title="Save edit" @click="saveEdit(action)">
                <CheckCircleIcon class="size-4" aria-hidden="true" />
              </button>
            </div>

            <div class="asana-cell asana-cell-assignee">
              <AssigneePicker
                :person-id="action.person_id"
                :person-name="action.person_name"
                @select="(person) => selectAssignee(action, person)"
                @create="(payload) => createAssignee(action, payload)"
                @clear="clearAssignee(action)"
              />
            </div>

            <div class="asana-cell">
              <button
                v-if="!isEditing(action)"
                class="asana-inline-trigger asana-due-trigger"
                :class="{
                  'is-overdue': isOverdue(action),
                  'is-today': isToday(action),
                  'is-empty': !action.due_date
                }"
                type="button"
                :title="action.due_date ? formatDate(action.due_date) : 'Set due date'"
                @click="openInlineEditor(action, 'dueDate')"
              >
                <CalendarDaysIcon
                  v-if="!action.due_date"
                  class="size-4 asana-due-empty-icon"
                  aria-hidden="true"
                />
                <span v-else>{{ isToday(action) ? 'Today' : formatDate(action.due_date) }}</span>
              </button>
              <input
                v-else
                ref="dueDateInput"
                v-model="draftDueDate"
                class="asana-inline-input asana-inline-date"
                type="date"
                @keydown.enter.prevent="saveEdit(action)"
                @keydown.esc.prevent="cancelEdit"
                @click.stop
              >
            </div>

            <div class="asana-cell asana-cell-source">
              <NuxtLink
                class="asana-source-pill"
                :to="`/documents/${action.document_id}`"
                :style="{ background: sourcePillFor(action).bg, color: sourcePillFor(action).fg }"
                :title="`${action.document_title} · ${action.document_source_type}`"
              >
                <component :is="sourceTypeIcon(action.document_source_type)" class="size-3.5 shrink-0" aria-hidden="true" />
                <span>{{ sourcePillFor(action).label }}</span>
              </NuxtLink>
            </div>

          </div>

          <p v-if="pending" class="muted p-4">Loading actions...</p>
          <p v-if="!pending && !actions.length" class="muted p-4">No actions match these filters.</p>
        </div>
      </section>
    </main>
  </div>
</template>
