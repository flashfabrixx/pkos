<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'

type EntityType = 'person' | 'project' | 'tag'
interface EntityRow {
  id: string
  name: string
}

const props = defineProps<{
  /** What kind of entity to search and create. */
  type: EntityType
  /** Entity ids to filter out of the result list (already attached). */
  excludeIds?: string[]
  /** Custom placeholder for the search input. */
  placeholder?: string
}>()

const emit = defineEmits<{
  /** Fired when the user picks an existing entity or creates a new one. */
  (event: 'select', value: { id?: string, name: string }): void
  /** Fired when the picker is dismissed without a selection. */
  (event: 'close'): void
}>()

const open = ref(false)
const queryStr = ref('')
const results = ref<EntityRow[]>([])
const fetching = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const endpoint = computed(() => {
  switch (props.type) {
    case 'person': return '/api/people'
    case 'project': return '/api/projects'
    case 'tag': return '/api/tags'
  }
})

const responseKey = computed(() => {
  switch (props.type) {
    case 'person': return 'people'
    case 'project': return 'projects'
    case 'tag': return 'tags'
  }
})

const filteredResults = computed(() => {
  const excluded = new Set(props.excludeIds || [])
  return results.value.filter((r) => !excluded.has(r.id))
})

const exactMatch = computed(() => {
  const needle = queryStr.value.trim().toLowerCase()
  if (!needle) return null
  return filteredResults.value.find((r) => r.name.toLowerCase() === needle) || null
})

let fetchAbort: AbortController | null = null

async function fetchResults(q: string) {
  fetchAbort?.abort()
  fetchAbort = new AbortController()
  fetching.value = true
  try {
    const data = await $fetch<Record<string, EntityRow[]>>(endpoint.value, {
      query: { q, limit: 8 },
      signal: fetchAbort.signal
    })
    results.value = data[responseKey.value] || []
  } catch (error) {
    if ((error as { name?: string })?.name !== 'AbortError') {
      console.error(`Failed to fetch ${responseKey.value}`, error)
    }
  } finally {
    fetching.value = false
  }
}

watch(queryStr, (value) => {
  if (!open.value) return
  void fetchResults(value)
})

async function openPicker() {
  open.value = true
  queryStr.value = ''
  await nextTick()
  inputRef.value?.focus()
  void fetchResults('')
}

function closePicker() {
  if (!open.value) return
  open.value = false
  queryStr.value = ''
  emit('close')
}

function selectExisting(row: EntityRow) {
  emit('select', { id: row.id, name: row.name })
  closePicker()
}

function createNew() {
  const name = queryStr.value.trim()
  if (!name) return
  if (exactMatch.value) {
    selectExisting(exactMatch.value)
    return
  }
  emit('select', { name })
  closePicker()
}

function onEnter() {
  if (exactMatch.value) selectExisting(exactMatch.value)
  else if (queryStr.value.trim()) createNew()
  else if (filteredResults.value[0]) selectExisting(filteredResults.value[0])
}

function handleClickOutside(event: MouseEvent) {
  if (!rootRef.value || !open.value) return
  if (!rootRef.value.contains(event.target as Node)) closePicker()
}

onMounted(() => {
  if (import.meta.client) document.addEventListener('mousedown', handleClickOutside)
})
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('mousedown', handleClickOutside)
})

defineExpose({ openPicker, closePicker })
</script>

<template>
  <div ref="rootRef" class="relative inline-block">
    <button
      type="button"
      class="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
      :aria-label="`Add ${props.type}`"
      @click="open ? closePicker() : openPicker()"
    >
      <PlusIcon class="size-4" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-30 mt-1 w-64 rounded-card border border-border-default bg-surface-1 p-2 shadow-popover"
      role="dialog"
    >
      <input
        ref="inputRef"
        v-model="queryStr"
        type="text"
        class="block w-full rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        :placeholder="props.placeholder || `Search or add a ${props.type}`"
        @keydown.esc.prevent="closePicker"
        @keydown.enter.prevent="onEnter"
      >
      <ul v-if="filteredResults.length" class="mt-1 max-h-56 overflow-auto">
        <li v-for="row in filteredResults" :key="row.id">
          <button
            type="button"
            class="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3"
            @click="selectExisting(row)"
          >
            <span class="truncate">{{ row.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="!fetching && !queryStr" class="px-2 py-1.5 text-xs text-muted">
        No {{ responseKey }} yet
      </p>
      <p v-else-if="!fetching && !filteredResults.length" class="px-2 py-1.5 text-xs text-muted">
        No matches
      </p>
      <button
        v-if="queryStr.trim() && !exactMatch"
        type="button"
        class="mt-1 inline-flex w-full items-center gap-1.5 border-t border-border-subtle px-2 py-1.5 text-left text-sm font-semibold text-accent hover:bg-accent-soft"
        @click="createNew"
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
        <span>Create &ldquo;{{ queryStr.trim() }}&rdquo;</span>
      </button>
    </div>
  </div>
</template>
