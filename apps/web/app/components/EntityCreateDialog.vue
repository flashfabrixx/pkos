<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'

type Kind = 'person' | 'project' | 'tag' | 'department'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  kind: Kind
}>()

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
          <DialogPanel class="entity-create-dialog">
            <DialogTitle class="entity-create-title">{{ heading }}</DialogTitle>
            <p class="entity-create-sub">{{ subheading }}</p>

            <form class="entity-create-form" @submit.prevent="submit">
              <label class="entity-create-field">
                <span>Name</span>
                <input
                  v-model="draftName"
                  type="text"
                  required
                  maxlength="200"
                  autofocus
                  :placeholder="kind === 'tag' ? 'e.g. customer-feedback' : kind === 'project' ? 'e.g. BKOS Rollout' : 'e.g. Marcus Schwarz'"
                >
              </label>
              <label class="entity-create-field">
                <span>Description (optional)</span>
                <textarea
                  v-model="draftDescription"
                  rows="3"
                  maxlength="2000"
                  placeholder="Short context about this entity…"
                />
              </label>

              <p v-if="error" class="entity-create-error">{{ error }}</p>

              <div class="entity-create-actions">
                <button type="button" class="entity-create-cancel" @click="open = false">Cancel</button>
                <button type="submit" class="entity-create-submit" :disabled="!draftName.trim() || pending">
                  {{ pending ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </form>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
