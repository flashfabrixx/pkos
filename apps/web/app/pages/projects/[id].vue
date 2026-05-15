<script setup lang="ts">
import { FolderIcon } from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

interface ActionRow {
  id: string
  title: string
  status: string
  due_date: string | null
  document_id: string
  document_title: string
  document_source_type: string
  person_id: string | null
  person_name: string | null
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
const { data, refresh } = await useFetch<any>(`/api/projects/${route.params.id}`)

const project = computed(() => data.value?.project || null)
const stats = computed(() => data.value?.stats || {})
const documents = computed(() => data.value?.documents || [])
const related = computed(() => data.value?.related || { people: [], projects: [], tags: [] })

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

const projectColor = computed(() => colorFor(project.value?.name))

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
    v-if="project"
    :entity="project"
    kind="project"
    eyebrow="Project"
    endpoint="/api/projects"
    :stats="stats"
    :related="related"
    :comments="comments"
    @update:entity="refresh"
    @update:comments="(value) => comments = value"
  >
    <template #avatar>
      <span
        class="avatar avatar--xl entity-tile"
        :style="{ background: projectColor.bg, color: projectColor.fg }"
      >
        <FolderIcon class="size-7" aria-hidden="true" />
      </span>
    </template>
    <template #sections>
      <EntityDocumentList :documents="documents" title="Documents" />
      <EntityActionList
        :actions="actions"
        title="Actions"
        secondary-field="person_name"
        secondary-route-base="/people"
        @toggle="toggleAction"
      />
    </template>
  </EntityDetailLayout>
</template>
