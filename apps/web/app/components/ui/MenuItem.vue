<script setup lang="ts">
import { MenuItem } from '@headlessui/vue'

defineProps<{ danger?: boolean, disabled?: boolean }>()
</script>

<template>
  <MenuItem v-slot="{ active, disabled: itemDisabled }" :disabled="disabled">
    <button
      type="button"
      :class="[
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
        active && !itemDisabled ? (danger ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent') : (danger ? 'text-danger' : 'text-text'),
        itemDisabled && 'cursor-not-allowed opacity-60'
      ]"
      :disabled="itemDisabled"
    >
      <slot />
    </button>
  </MenuItem>
</template>
