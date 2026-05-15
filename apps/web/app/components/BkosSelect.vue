<script setup lang="ts">
import type { Component } from 'vue'
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions
} from '@headlessui/vue'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/20/solid'

const model = defineModel<string>({ required: true })

const props = defineProps<{
  label: string
  options: Array<{ value: string, label: string, icon?: Component }>
  required?: boolean
}>()

const selectedOption = computed(() => props.options.find((option) => option.value === model.value) || props.options[0])
</script>

<template>
  <Listbox v-model="model" as="div" class="bkos-select">
    <ListboxLabel class="bkos-select-label">
      <span>{{ label }}</span>
      <strong v-if="required" class="required">*</strong>
    </ListboxLabel>

    <div class="relative mt-1.5">
      <ListboxButton class="bkos-select-button">
        <span class="flex min-w-0 items-center gap-2">
          <component :is="selectedOption.icon" v-if="selectedOption?.icon" class="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span class="block truncate">{{ selectedOption?.label }}</span>
        </span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon class="size-5 text-slate-400" aria-hidden="true" />
        </span>
      </ListboxButton>

      <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <ListboxOptions class="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg outline outline-1 outline-black/5">
          <ListboxOption v-for="option in options" :key="option.value" v-slot="{ active, selected }" :value="option.value" as="template">
            <li :class="['relative cursor-default select-none py-2 pl-9 pr-3', active ? 'bg-blue-600 text-white' : 'text-slate-900']">
              <span :class="['flex min-w-0 items-center gap-2', selected ? 'font-semibold' : 'font-normal']">
                <component :is="option.icon" v-if="option.icon" :class="['size-4 shrink-0', active ? 'text-white' : 'text-slate-500']" aria-hidden="true" />
                <span class="block truncate">{{ option.label }}</span>
              </span>
              <span v-if="selected" :class="['absolute inset-y-0 left-0 flex items-center pl-2.5', active ? 'text-white' : 'text-blue-600']">
                <CheckIcon class="size-4" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
        </ListboxOptions>
      </transition>
    </div>
  </Listbox>
</template>
