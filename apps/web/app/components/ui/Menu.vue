<script setup lang="ts">
import { Menu, MenuButton, MenuItems } from '@headlessui/vue'

defineProps<{ buttonLabel: string, buttonSize?: 'sm' | 'md' }>()
</script>

<template>
  <Menu as="div" class="relative">
    <MenuButton
      :class="[
        'inline-flex items-center justify-center rounded-md text-text-soft transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        buttonSize === 'sm' ? 'size-8' : 'size-9'
      ]"
      :aria-label="buttonLabel"
    >
      <slot name="button" />
    </MenuButton>
    <MenuItems
      class="absolute right-0 z-30 mt-1 w-56 origin-top-right rounded-md border border-border-default bg-surface-1 py-1 text-sm shadow-popover focus:outline-none"
    >
      <slot />
    </MenuItems>
  </Menu>
</template>
