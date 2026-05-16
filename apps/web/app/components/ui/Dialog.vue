<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogDescription,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue'
import { computed } from 'vue'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  size?: Size
  initialFocus?: HTMLElement | null
}>(), { size: 'md' })

const emit = defineEmits<{ close: [] }>()

const widthClass = computed(() => ({
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}[props.size]))

function close() {
  emit('close')
}
</script>

<template>
  <TransitionRoot :show="open" as="template" appear>
    <Dialog :initial-focus="initialFocus ?? undefined" class="relative z-40" @close="close">
      <TransitionChild
        enter="ease-out duration-150"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-100"
        leave-from="opacity-100"
        leave-to="opacity-0"
        as="template"
      >
        <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-start justify-center p-4 sm:items-center">
          <TransitionChild
            enter="ease-out duration-150"
            enter-from="opacity-0 translate-y-2 scale-95"
            enter-to="opacity-100 translate-y-0 scale-100"
            leave="ease-in duration-100"
            leave-from="opacity-100 translate-y-0 scale-100"
            leave-to="opacity-0 translate-y-2 scale-95"
            as="template"
          >
            <DialogPanel
              :class="['w-full rounded-card bg-surface-1 shadow-popover ring-1 ring-border-default', widthClass]"
            >
              <header v-if="title || description" class="space-y-1 border-b border-border-subtle px-5 py-4">
                <DialogTitle v-if="title" class="text-base font-semibold text-text-strong">{{ title }}</DialogTitle>
                <DialogDescription v-if="description" class="text-sm text-text-soft">{{ description }}</DialogDescription>
              </header>
              <div class="p-5">
                <slot :close="close" />
              </div>
              <footer v-if="$slots.footer" class="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
                <slot name="footer" :close="close" />
              </footer>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
