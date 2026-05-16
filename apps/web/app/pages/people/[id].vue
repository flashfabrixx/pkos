<script setup lang="ts">
import { colorFor } from '~/utils/hash-color'

interface ActionRow {
  id: string
  title: string
  status: string
  due_date: string | null
  document_id: string
  document_title?: string
  document_source_type?: string
  project_id?: string | null
  project_name?: string | null
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
const { data, refresh } = await useFetch<any>(`/api/people/${route.params.id}`)

const person = computed(() => data.value?.person || null)
useHead({ title: () => person.value?.name || 'Person' })
const stats = computed(() => data.value?.stats || {})
const documents = computed(() => data.value?.documents || [])
const related = computed(() => data.value?.related || { people: [], projects: [], tags: [] })
const activities = computed(() => data.value?.activities || [])

const actions = ref<ActionRow[]>([])
const comments = ref<CommentRow[]>([])
watch(
  data,
  (value) => {
    actions.value = value?.actions || []
    comments.value = value?.comments || []
  },
  { immediate: true }
)

const initials = computed(() => {
  if (!person.value?.name) return '?'
  const parts = person.value.name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase()
})
const avatarColor = computed(() => colorFor(person.value?.name))

async function toggleAction(action: ActionRow) {
  const previous = action.status
  const next = previous === 'done' ? 'open' : 'done'
  action.status = next
  try {
    await $fetch(`/api/actions/${action.id}`, { method: 'PATCH', body: { status: next } })
  } catch (error) {
    action.status = previous
    console.error('Failed to update action', error)
  }
}
</script>

<template>
  <EntityDetailLayout
    v-if="person"
    :entity="person"
    kind="person"
    eyebrow="Person"
    endpoint="/api/people"
    :stats="stats"
    :related="related"
    :comments="comments"
    :activities="activities"
    @update:entity="refresh"
    @update:comments="(value) => comments = value"
  >
    <template #avatar>
      <span
        class="avatar avatar--xl"
        :style="{ background: avatarColor.bg, color: avatarColor.fg }"
      >{{ initials }}</span>
    </template>
    <template #sections>
      <EntityDocumentList :documents="documents" title="Mentioned in" />
      <EntityActionList
        :actions="actions"
        title="Actions assigned"
        secondary-field="project_name"
        secondary-route-base="/projects"
        @toggle="toggleAction"
      />
    </template>
  </EntityDetailLayout>
</template>
