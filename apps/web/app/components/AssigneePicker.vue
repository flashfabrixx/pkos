<script setup lang="ts">
import { PlusIcon, UserIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { colorFor } from '~/utils/hash-color'

interface Person {
  id: string
  name: string
}

const props = defineProps<{
  personId?: string | null
  personName?: string | null
  placeholder?: string
}>()

const avatarColor = computed(() => colorFor(props.personName))

const emit = defineEmits<{
  (event: 'select', value: { id: string, name: string }): void
  (event: 'create', value: { name: string }): void
  (event: 'clear'): void
}>()

const open = ref(false)
const queryStr = ref('')
const results = ref<Person[]>([])
const fetching = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const initials = computed(() => {
  if (!props.personName) return ''
  const parts = props.personName.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase()
})

const hasExactMatch = computed(() =>
  results.value.some((person) => person.name.toLowerCase() === queryStr.value.trim().toLowerCase())
)

let fetchAbort: AbortController | null = null

async function fetchPeople(q: string) {
  fetchAbort?.abort()
  fetchAbort = new AbortController()
  fetching.value = true
  try {
    const data = await $fetch<{ people: Person[] }>('/api/people', {
      query: { q, limit: 8 },
      signal: fetchAbort.signal
    })
    results.value = data.people
  } catch (error) {
    if ((error as { name?: string })?.name !== 'AbortError') {
      console.error('Failed to fetch people', error)
    }
  } finally {
    fetching.value = false
  }
}

watch(queryStr, (value) => {
  if (!open.value) return
  void fetchPeople(value)
})

async function openPicker() {
  open.value = true
  queryStr.value = ''
  await nextTick()
  inputRef.value?.focus()
  void fetchPeople('')
}

function closePicker() {
  open.value = false
  queryStr.value = ''
}

function selectPerson(person: Person) {
  emit('select', person)
  closePicker()
}

function createPerson() {
  const name = queryStr.value.trim()
  if (!name) return
  emit('create', { name })
  closePicker()
}

function clearAssignee(event: Event) {
  event.stopPropagation()
  emit('clear')
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
</script>

<template>
  <div ref="rootRef" class="assignee-picker">
    <button
      v-if="personName"
      type="button"
      class="assignee-pill"
      :title="personName"
      @click="openPicker"
    >
      <span class="assignee-avatar" :style="{ background: avatarColor.bg, color: avatarColor.fg }">{{ initials || '?' }}</span>
      <span class="assignee-name">{{ personName }}</span>
      <span class="assignee-clear" :aria-label="`Remove ${personName}`" @click="clearAssignee">
        <XMarkIcon class="size-3" aria-hidden="true" />
      </span>
    </button>
    <button v-else type="button" class="assignee-empty" @click="openPicker">
      <UserIcon class="size-3.5" aria-hidden="true" />
      <span>{{ placeholder || 'Assign' }}</span>
    </button>

    <div v-if="open" class="assignee-popover" role="dialog">
      <input
        ref="inputRef"
        v-model="queryStr"
        type="text"
        class="assignee-input"
        placeholder="Search or add a person"
        @keydown.esc.prevent="closePicker"
        @keydown.enter.prevent="queryStr.trim() && !hasExactMatch ? createPerson() : results[0] && selectPerson(results[0])"
      >
      <ul v-if="results.length" class="assignee-results">
        <li v-for="person in results" :key="person.id">
          <button type="button" class="assignee-option" @click="selectPerson(person)">
            <span>{{ person.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="!fetching && !queryStr" class="assignee-empty-state">No people yet</p>
      <p v-else-if="!fetching && !results.length" class="assignee-empty-state">No matches</p>
      <button
        v-if="queryStr.trim() && !hasExactMatch"
        type="button"
        class="assignee-create"
        @click="createPerson"
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
        <span>Create &ldquo;{{ queryStr.trim() }}&rdquo;</span>
      </button>
    </div>
  </div>
</template>
