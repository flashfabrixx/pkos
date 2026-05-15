<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { colorFor } from '~/utils/hash-color'

type Kind = 'person' | 'project' | 'tag'

interface EntityCandidate {
  id: string
  name: string
  document_count?: number
  actions_open?: number
  actions_done?: number
  last_seen?: string | null
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  kind: Kind
  candidates: EntityCandidate[]
}>()

const emit = defineEmits<{
  (e: 'merged', value: { primaryId: string }): void
}>()

const primaryId = ref<string | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)

watch(open, (value) => {
  if (value) {
    primaryId.value = props.candidates[0]?.id || null
    error.value = null
    pending.value = false
  }
})

const kindLabel = computed(() => (props.kind === 'person' ? 'person' : props.kind === 'project' ? 'project' : 'tag'))

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase()
}

function formatDate(value: string | null | undefined) {
  return formatBrowserDate(value, '—')
}

async function submit() {
  if (!primaryId.value || pending.value) return
  if (props.candidates.length < 2) return
  pending.value = true
  error.value = null
  try {
    const mergeIds = props.candidates.map((c) => c.id).filter((id) => id !== primaryId.value)
    await $fetch('/api/entities/merge', {
      method: 'POST',
      body: { primaryId: primaryId.value, mergeIds }
    })
    emit('merged', { primaryId: primaryId.value })
    open.value = false
  } catch (e: any) {
    error.value = e?.statusMessage || e?.data?.statusMessage || 'Failed to merge'
    pending.value = false
  }
}
</script>

<template>
  <TransitionRoot :show="open" as="template" appear>
    <Dialog class="relative z-50" @close="open = false">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-500/25" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-150"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel class="entity-merge-dialog">
            <DialogTitle class="entity-create-title">Merge {{ candidates.length }} {{ kindLabel }}{{ candidates.length === 1 ? '' : 's' }}</DialogTitle>
            <p class="entity-create-sub">Pick the entity that should survive. All mentions, comments, edges and assignments from the other entries will be moved over, then the originals are removed.</p>

            <ul class="merge-candidates">
              <li v-for="entity in candidates" :key="entity.id" :class="{ 'is-primary': primaryId === entity.id }">
                <label class="merge-candidate-label">
                  <input type="radio" :value="entity.id" v-model="primaryId">
                  <span class="merge-candidate-card">
                    <span v-if="kind === 'person'" class="avatar" :style="{ background: colorFor(entity.name).bg, color: colorFor(entity.name).fg }">{{ initialsOf(entity.name) }}</span>
                    <span class="merge-candidate-text">
                      <span class="merge-candidate-name">{{ kind === 'tag' ? `#${entity.name}` : entity.name }}</span>
                      <span class="merge-candidate-meta">
                        <span v-if="entity.document_count !== undefined">{{ entity.document_count }} docs</span>
                        <span v-if="(entity.actions_open || 0) + (entity.actions_done || 0) > 0">
                          {{ entity.actions_open }} open · {{ entity.actions_done }} done
                        </span>
                        <span v-if="entity.last_seen">last {{ formatDate(entity.last_seen) }}</span>
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            </ul>

            <p v-if="error" class="entity-create-error">{{ error }}</p>

            <div class="entity-create-actions">
              <button type="button" class="entity-create-cancel" @click="open = false">Cancel</button>
              <button
                type="button"
                class="entity-create-submit"
                :disabled="!primaryId || candidates.length < 2 || pending"
                @click="submit"
              >
                {{ pending ? 'Merging…' : 'Merge into selected' }}
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
