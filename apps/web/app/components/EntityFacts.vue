<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LightBulbIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

interface FactRow {
  id: string
  entity_id: string
  body: string
  position: number
  created_at: string
  updated_at: string
}

const props = defineProps<{
  /** Entity to manage facts for. */
  entityId: string
  /** Display label for the entity in the empty-state hint. */
  entityKind: 'person' | 'project' | 'tag'
}>()

const facts = ref<FactRow[]>([])
const loading = ref(true)
const adding = ref(false)
const draft = ref('')
const editingId = ref<string | null>(null)
const editingDraft = ref('')
const editingRef = ref<HTMLTextAreaElement | null>(null)

async function load() {
  loading.value = true
  try {
    const r = await $fetch<{ facts: FactRow[] }>(`/api/entities/${props.entityId}/facts`)
    facts.value = r.facts
  } catch (error) {
    console.error('Failed to load facts', error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.entityId, load)

async function addFact() {
  const body = draft.value.trim()
  if (!body || adding.value) return
  adding.value = true
  try {
    const r = await $fetch<{ fact: FactRow }>(`/api/entities/${props.entityId}/facts`, {
      method: 'POST',
      body: { body }
    })
    facts.value.push(r.fact)
    draft.value = ''
  } catch (error) {
    console.error('Failed to add fact', error)
  } finally {
    adding.value = false
  }
}

function beginEdit(fact: FactRow) {
  editingId.value = fact.id
  editingDraft.value = fact.body
  void nextTick(() => editingRef.value?.focus())
}

function cancelEdit() {
  editingId.value = null
  editingDraft.value = ''
}

async function commitEdit(fact: FactRow) {
  if (editingId.value !== fact.id) return
  const next = editingDraft.value.trim()
  if (!next || next === fact.body) {
    cancelEdit()
    return
  }
  const previous = fact.body
  fact.body = next // optimistic
  try {
    await $fetch(`/api/entities/${props.entityId}/facts/${fact.id}`, {
      method: 'PATCH',
      body: { body: next }
    })
  } catch (error) {
    fact.body = previous
    console.error('Failed to update fact', error)
  } finally {
    cancelEdit()
  }
}

async function removeFact(fact: FactRow) {
  const idx = facts.value.findIndex((f) => f.id === fact.id)
  if (idx === -1) return
  const removed = facts.value.splice(idx, 1)[0]
  try {
    await $fetch(`/api/entities/${props.entityId}/facts/${fact.id}`, { method: 'DELETE' })
  } catch (error) {
    facts.value.splice(idx, 0, removed!)
    console.error('Failed to delete fact', error)
  }
}

async function move(fact: FactRow, delta: -1 | 1) {
  const idx = facts.value.findIndex((f) => f.id === fact.id)
  const target = idx + delta
  if (idx === -1 || target < 0 || target >= facts.value.length) return
  // Local swap first, then persist.
  ;[facts.value[idx], facts.value[target]] = [facts.value[target]!, facts.value[idx]!]
  try {
    await $fetch(`/api/entities/${props.entityId}/facts/${fact.id}`, {
      method: 'PATCH',
      body: { position: target }
    })
  } catch (error) {
    // Best-effort revert; reload from server to resync ordering.
    console.error('Failed to reorder fact', error)
    await load()
  }
}

function onEnterAdd(event: KeyboardEvent) {
  if (event.shiftKey) return
  event.preventDefault()
  void addFact()
}

function onEnterEdit(event: KeyboardEvent, fact: FactRow) {
  if (event.shiftKey) return
  event.preventDefault()
  void commitEdit(fact)
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center gap-2 border-b border-border-subtle pb-1.5 text-sm font-semibold text-text-strong">
      <LightBulbIcon class="size-4 text-muted" aria-hidden="true" />
      <h3>Facts</h3>
      <span class="text-xs font-normal text-muted">{{ facts.length }}</span>
    </div>

    <p class="text-xs text-muted">
      Short, curated bullets the assistant will remember when this {{ entityKind }} comes up in a thread.
    </p>

    <ul v-if="facts.length" class="space-y-1.5">
      <li
        v-for="(fact, i) in facts"
        :key="fact.id"
        class="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
      >
        <div class="flex shrink-0 flex-col items-center gap-0.5 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            class="inline-flex size-4 items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            :disabled="i === 0"
            :aria-label="`Move fact up`"
            @click="move(fact, -1)"
          >
            <ArrowUpIcon class="size-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="inline-flex size-4 items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
            :disabled="i === facts.length - 1"
            :aria-label="`Move fact down`"
            @click="move(fact, 1)"
          >
            <ArrowDownIcon class="size-3" aria-hidden="true" />
          </button>
        </div>

        <textarea
          v-if="editingId === fact.id"
          ref="editingRef"
          v-model="editingDraft"
          rows="2"
          class="block min-w-0 flex-1 resize-none rounded border border-border-strong bg-surface-1 px-2 py-1 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          @keydown.enter="onEnterEdit($event, fact)"
          @keydown.esc.prevent="cancelEdit"
          @blur="commitEdit(fact)"
        />
        <button
          v-else
          type="button"
          class="min-w-0 flex-1 whitespace-pre-wrap text-left text-sm leading-relaxed text-text"
          :title="`Edit fact`"
          @click="beginEdit(fact)"
        >{{ fact.body }}</button>

        <button
          type="button"
          class="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
          :aria-label="`Remove fact`"
          :title="`Remove fact`"
          @click="removeFact(fact)"
        >
          <XMarkIcon class="size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-xs text-muted">No facts yet.</p>

    <form class="flex items-start gap-2 pt-1" @submit.prevent="addFact">
      <textarea
        v-model="draft"
        rows="1"
        :placeholder="`Add a fact about this ${entityKind}…`"
        class="block min-w-0 flex-1 resize-none rounded-md border border-border-default bg-surface-1 px-2 py-1.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        :disabled="adding"
        @keydown.enter="onEnterAdd"
      />
      <button
        type="submit"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="adding || !draft.trim()"
        :aria-label="`Add fact`"
      >
        <PlusIcon class="size-4" aria-hidden="true" />
      </button>
    </form>
  </section>
</template>
