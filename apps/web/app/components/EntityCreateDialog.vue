<script setup lang="ts">
type Kind = 'person' | 'project' | 'tag' | 'department'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ kind: Kind }>()

const emit = defineEmits<{
  (e: 'created', value: { id: string, type: Kind, name: string }): void
}>()

const draftName = ref('')
const draftDescription = ref('')
const pending = ref(false)
const error = ref<string | null>(null)

const heading = computed(() => {
  if (props.kind === 'person') return 'Add person'
  if (props.kind === 'project') return 'Add project'
  if (props.kind === 'department') return 'Add department'
  return 'Add tag'
})
const subheading = computed(() => `Create a new ${props.kind} entity. You can refine details on the next page.`)

watch(open, (value) => {
  if (value) {
    draftName.value = ''
    draftDescription.value = ''
    error.value = null
    pending.value = false
  }
})

async function submit() {
  const name = draftName.value.trim()
  if (!name || pending.value) return
  pending.value = true
  error.value = null
  try {
    const result = await $fetch<{ entity: { id: string, type: Kind, name: string } }>('/api/entities', {
      method: 'POST',
      body: {
        type: props.kind,
        name,
        description: draftDescription.value.trim() || null
      }
    })
    emit('created', result.entity)
    open.value = false
  } catch (e: any) {
    error.value = e?.statusMessage || e?.data?.statusMessage || 'Failed to create entity'
    pending.value = false
  }
}

const placeholder = computed(() => {
  if (props.kind === 'tag') return 'e.g. customer-feedback'
  if (props.kind === 'project') return 'e.g. PKOS Rollout'
  if (props.kind === 'department') return 'e.g. Engineering'
  return 'e.g. Marcus Schwarz'
})
</script>

<template>
  <UiDialog :open="open" :title="heading" :description="subheading" size="sm" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <UiField label="Name" required>
        <template #default="{ id }">
          <UiInput
            :id="id"
            v-model="draftName"
            type="text"
            required
            maxlength="200"
            autofocus
            :placeholder="placeholder"
          />
        </template>
      </UiField>
      <UiField label="Description" hint="Short context about this entity (optional).">
        <template #default="{ id }">
          <UiTextarea
            :id="id"
            v-model="draftDescription"
            :rows="3"
            maxlength="2000"
            placeholder="Short context about this entity…"
          />
        </template>
      </UiField>

      <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <UiButton type="button" variant="secondary" size="sm" @click="open = false">Cancel</UiButton>
        <UiButton
          type="submit"
          size="sm"
          :disabled="!draftName.trim()"
          :loading="pending"
        >{{ pending ? 'Creating…' : 'Create' }}</UiButton>
      </div>
    </form>
  </UiDialog>
</template>
