<script setup lang="ts">
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
useHead({ title: () => (tag.value?.name ? `#${tag.value.name}` : 'Tag') })
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
    <template #sections>
      <EntityDocumentList :documents="documents" title="Tagged documents" />
    </template>
  </EntityDetailLayout>
</template>
