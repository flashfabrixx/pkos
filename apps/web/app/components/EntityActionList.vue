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
  secondaryField?: 'project_name' | 'person_name'
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
  <section v-if="actions.length" class="space-y-2">
    <div class="flex items-center gap-2">
      <ClipboardDocumentCheckIcon class="size-5 text-muted" aria-hidden="true" />
      <h2 class="text-sm font-semibold text-text-strong">{{ headingText }}</h2>
      <span class="text-xs text-muted">{{ actions.length }}</span>
    </div>
    <ul class="divide-y divide-border-subtle">
      <li
        v-for="action in actions"
        :key="action.id"
        :class="[
          'grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 py-2',
          isActionDone(action.status) && 'opacity-70'
        ]"
      >
        <button
          type="button"
          :class="[
            'inline-flex size-7 items-center justify-center rounded-full transition-colors',
            isActionDone(action.status)
              ? 'text-success hover:bg-success-soft'
              : 'text-muted-soft hover:text-success hover:bg-success-soft'
          ]"
          @click="emit('toggle', action)"
        >
          <CheckCircleIcon class="size-5" aria-hidden="true" />
        </button>
        <div class="min-w-0">
          <NuxtLink :to="`/documents/${action.document_id}`" class="block truncate text-sm text-text hover:text-accent">
            <span :class="isActionDone(action.status) && 'text-muted line-through'">{{ action.title }}</span>
          </NuxtLink>
        </div>
        <div class="min-w-0 text-xs">
          <NuxtLink
            v-if="secondaryRoute(action)"
            :to="secondaryRoute(action)!"
            class="truncate text-accent hover:underline"
          >{{ secondaryText(action) }}</NuxtLink>
          <span v-else-if="secondaryText(action)" class="truncate text-text-soft">{{ secondaryText(action) }}</span>
        </div>
        <div class="min-w-0 text-xs">
          <span
            :class="[
              'inline-flex items-center gap-1.5',
              isOverdue(action) && 'text-danger font-medium',
              isToday(action) && !isOverdue(action) && 'text-warning font-medium',
              !action.due_date && 'text-muted-soft'
            ]"
          >
            <CalendarDaysIcon v-if="!action.due_date" class="size-4" aria-hidden="true" />
            <span v-else>{{ isToday(action) ? 'Today' : formatDate(action.due_date) }}</span>
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
