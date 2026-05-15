<script setup lang="ts">
import { HashtagIcon } from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

interface CommentRow {
  id: string
  entity_id: string
  body: string
  document_id: string | null
  created_at: string
  updated_at: string
}

const route = useRoute()
const { data, refresh } = await useFetch<any>(`/api/tags/${route.params.id}`)

const tag = computed(() => data.value?.tag || null)
const stats = computed(() => data.value?.stats || {})
const documents = computed(() => data.value?.documents || [])
const related = computed(() => data.value?.related || { people: [], projects: [], tags: [] })
const activities = computed(() => data.value?.activities || [])

const comments = ref<CommentRow[]>([])
watch(
  data,
  (value) => { comments.value = value?.comments || [] },
  { immediate: true }
)

const tagColor = computed(() => colorFor(tag.value?.name))
</script>

<template>
  <EntityDetailLayout
    v-if="tag"
    :entity="tag"
    kind="tag"
    eyebrow="Tag"
    endpoint="/api/tags"
    :stats="stats"
    :related="related"
    :comments="comments"
    :activities="activities"
    @update:entity="refresh"
    @update:comments="(value) => comments = value"
  >
    <template #avatar>
      <span
        class="avatar avatar--xl entity-tile"
        :style="{ background: tagColor.bg, color: tagColor.fg }"
      >
        <HashtagIcon class="size-7" aria-hidden="true" />
      </span>
    </template>
    <template #sections>
      <EntityDocumentList :documents="documents" title="Tagged documents" />
    </template>
  </EntityDetailLayout>
</template>
