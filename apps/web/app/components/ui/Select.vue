<script setup lang="ts" generic="T extends string | number">
import type { Component } from 'vue'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/20/solid'
import { computed } from 'vue'

interface Option { value: T, label: string, icon?: Component, disabled?: boolean }

const props = defineProps<{
  modelValue: T
  options: Option[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue))

function setValue(value: T) {
  emit('update:modelValue', value)
}
</script>

<template>
  <Listbox :model-value="modelValue" :disabled="disabled" as="div" class="relative" @update:model-value="setValue">
    <ListboxButton
      class="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-1 px-3 text-sm text-text shadow-sm transition-colors hover:bg-surface-3 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span class="flex min-w-0 items-center gap-2">
        <component
          :is="selectedOption.icon"
          v-if="selectedOption?.icon"
          class="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="truncate" :class="!modelValue && placeholder && 'text-muted-soft'">
          {{ selectedOption?.label ?? placeholder ?? '' }}
        </span>
      </span>
      <ChevronUpDownIcon class="size-4 shrink-0 text-muted-soft" aria-hidden="true" />
    </ListboxButton>

    <ListboxOptions
      class="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border-default bg-surface-1 py-1 text-sm shadow-popover focus:outline-none"
    >
      <ListboxOption
        v-for="option in options"
        :key="option.value"
        v-slot="{ active, selected }"
        :value="option.value"
        :disabled="option.disabled"
        as="template"
      >
        <li
          :class="[
            'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5',
            active ? 'bg-accent-soft text-accent' : 'text-text',
            option.disabled && 'cursor-not-allowed opacity-60'
          ]"
        >
          <span class="flex min-w-0 items-center gap-2">
            <component
              :is="option.icon"
              v-if="option.icon"
              :class="['size-4 shrink-0', active ? 'text-accent' : 'text-muted']"
              aria-hidden="true"
            />
            <span class="truncate">{{ option.label }}</span>
          </span>
          <CheckIcon v-if="selected" class="size-4 shrink-0" aria-hidden="true" />
        </li>
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>
