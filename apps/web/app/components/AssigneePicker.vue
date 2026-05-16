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
  <div ref="rootRef" class="relative">
    <button
      v-if="personName"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs hover:bg-surface-3"
      :title="personName"
      @click="openPicker"
    >
      <span
        class="inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold"
        :style="{ background: avatarColor.bg, color: avatarColor.fg }"
      >{{ initials || '?' }}</span>
      <span class="truncate text-text">{{ personName }}</span>
      <span
        class="inline-flex size-4 items-center justify-center rounded-full text-muted-soft hover:bg-surface-1 hover:text-danger"
        role="button"
        :aria-label="`Remove ${personName}`"
        @click="clearAssignee"
      >
        <XMarkIcon class="size-3" aria-hidden="true" />
      </span>
    </button>
    <button
      v-else
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-default px-2 py-1 text-xs text-muted hover:border-border-strong hover:bg-surface-2 hover:text-text"
      @click="openPicker"
    >
      <UserIcon class="size-3.5" aria-hidden="true" />
      <span>{{ placeholder || 'Assign' }}</span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-30 mt-1 w-64 rounded-card border border-border-default bg-surface-1 p-2 shadow-popover"
      role="dialog"
    >
      <input
        ref="inputRef"
        v-model="queryStr"
        type="text"
        class="block w-full rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        placeholder="Search or add a person"
        @keydown.esc.prevent="closePicker"
        @keydown.enter.prevent="queryStr.trim() && !hasExactMatch ? createPerson() : results[0] && selectPerson(results[0])"
      >
      <ul v-if="results.length" class="mt-1 max-h-56 overflow-auto">
        <li v-for="person in results" :key="person.id">
          <button
            type="button"
            class="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-3"
            @click="selectPerson(person)"
          >
            <span>{{ person.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="!fetching && !queryStr" class="px-2 py-1.5 text-xs text-muted">No people yet</p>
      <p v-else-if="!fetching && !results.length" class="px-2 py-1.5 text-xs text-muted">No matches</p>
      <button
        v-if="queryStr.trim() && !hasExactMatch"
        type="button"
        class="mt-1 inline-flex w-full items-center gap-1.5 border-t border-border-subtle px-2 py-1.5 text-left text-sm font-semibold text-accent hover:bg-accent-soft"
        @click="createPerson"
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
        <span>Create &ldquo;{{ queryStr.trim() }}&rdquo;</span>
      </button>
    </div>
  </div>
</template>
