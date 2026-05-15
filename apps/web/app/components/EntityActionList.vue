<script setup lang="ts">
import { CalendarDaysIcon, CheckCircleIcon, ClipboardDocumentCheckIcon } from '@heroicons/vue/24/outline'

interface ActionRow {
  id: string
  title: string
  status: string
  due_date: string | null
  document_id: string
  document_title?: string
  document_source_type?: string
  person_id?: string | null
  person_name?: string | null
  project_id?: string | null
  project_name?: string | null
}

const props = defineProps<{
  actions: ActionRow[]
  title?: string
  /** Which secondary field to show alongside the title (e.g. project_name in /people/:id, person_name in /projects/:id). */
  secondaryField?: 'project_name' | 'person_name'
  /** Route base for the secondary entity link, e.g. '/projects' or '/people'. */
  secondaryRouteBase?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', action: ActionRow): void
}>()

const headingText = computed(() => props.title || 'Actions')

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const isOverdue = (a: ActionRow) =>
  !!a.due_date && !['done', 'dismissed'].includes(a.status) && String(a.due_date).slice(0, 10) < TODAY_ISO
const isToday = (a: ActionRow) => !!a.due_date && String(a.due_date).slice(0, 10) === TODAY_ISO
const isActionDone = (s: string | null | undefined) => String(s || '').toLowerCase() === 'done'

function formatDate(value: string | null | undefined, fallback = '') {
  return formatBrowserDate(value, fallback)
}

function secondaryText(action: ActionRow): string | null {
  if (!props.secondaryField) return null
  const value = action[props.secondaryField]
  return typeof value === 'string' ? value : null
}

function secondaryRoute(action: ActionRow): string | null {
  if (!props.secondaryRouteBase) return null
  const idField = props.secondaryField === 'project_name' ? 'project_id' : 'person_id'
  const id = action[idField as 'project_id' | 'person_id']
  return id ? `${props.secondaryRouteBase}/${id}` : null
}
</script>

<template>
  <section v-if="actions.length" class="doc-section">
    <div class="doc-section-head">
      <div class="doc-section-title">
        <ClipboardDocumentCheckIcon class="size-5 text-slate-500" aria-hidden="true" />
        <h2>{{ headingText }}</h2>
        <span class="count">{{ actions.length }}</span>
      </div>
    </div>
    <ul class="doc-action-list">
      <li
        v-for="action in actions"
        :key="action.id"
        class="doc-action-row"
        :class="{ 'is-done': isActionDone(action.status) }"
      >
        <button
          type="button"
          class="doc-action-check"
          :class="isActionDone(action.status) ? 'is-done' : 'is-open'"
          @click="emit('toggle', action)"
        >
          <CheckCircleIcon class="size-5" aria-hidden="true" />
        </button>
        <div class="doc-action-title">
          <NuxtLink :to="`/documents/${action.document_id}`" class="doc-row-edit-trigger">
            <span :class="{ 'is-done': isActionDone(action.status) }">{{ action.title }}</span>
          </NuxtLink>
        </div>
        <div class="doc-action-assignee">
          <NuxtLink
            v-if="secondaryRoute(action)"
            :to="secondaryRoute(action)!"
            class="entity-action-project"
          >{{ secondaryText(action) }}</NuxtLink>
          <span v-else-if="secondaryText(action)" class="entity-action-project">{{ secondaryText(action) }}</span>
        </div>
        <div class="doc-action-due">
          <span
            class="doc-action-due-trigger"
            :class="{ 'is-overdue': isOverdue(action), 'is-today': isToday(action), 'is-empty': !action.due_date }"
          >
            <CalendarDaysIcon v-if="!action.due_date" class="size-4 asana-due-empty-icon" aria-hidden="true" />
            <span v-else>{{ isToday(action) ? 'Today' : formatDate(action.due_date) }}</span>
          </span>
        </div>
        <span></span>
      </li>
    </ul>
  </section>
</template>
