<script setup lang="ts">
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
  <UiDialog
    :open="open"
    :title="`Merge ${candidates.length} ${kindLabel}${candidates.length === 1 ? '' : 's'}`"
    description="Pick the entity that should survive. All mentions, comments, edges and assignments from the other entries will be moved over, then the originals are removed."
    size="lg"
    @close="open = false"
  >
    <div class="space-y-4">
      <ul class="space-y-2">
        <li v-for="entity in candidates" :key="entity.id">
          <label
            :class="[
              'flex cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors',
              primaryId === entity.id
                ? 'border-accent bg-accent-soft'
                : 'border-border-default bg-surface-1 hover:bg-surface-2'
            ]"
          >
            <input
              type="radio"
              :value="entity.id"
              v-model="primaryId"
              class="size-4 shrink-0 text-accent focus:ring-2 focus:ring-accent/20"
            >
            <span class="flex min-w-0 flex-1 items-center gap-3">
              <span
                v-if="kind === 'person'"
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :style="{ background: colorFor(entity.name).bg, color: colorFor(entity.name).fg }"
              >{{ initialsOf(entity.name) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-text-strong">{{ kind === 'tag' ? `#${entity.name}` : entity.name }}</span>
                <span class="flex flex-wrap gap-3 text-xs text-muted">
                  <span v-if="entity.document_count !== undefined">{{ entity.document_count }} docs</span>
                  <span v-if="(entity.actions_open || 0) + (entity.actions_done || 0) > 0">{{ entity.actions_open }} open · {{ entity.actions_done }} done</span>
                  <span v-if="entity.last_seen">last {{ formatDate(entity.last_seen) }}</span>
                </span>
              </span>
            </span>
          </label>
        </li>
      </ul>

      <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <UiButton type="button" variant="secondary" size="sm" @click="open = false">Cancel</UiButton>
        <UiButton
          type="button"
          size="sm"
          :disabled="!primaryId || candidates.length < 2"
          :loading="pending"
          @click="submit"
        >{{ pending ? 'Merging…' : 'Merge into selected' }}</UiButton>
      </div>
    </div>
  </UiDialog>
</template>
