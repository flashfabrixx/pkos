<script setup lang="ts">
import { ChatBubbleLeftRightIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('threads.title') })

interface ThreadRow {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  archived_at: string | null
  last_message_at: string | null
  message_count: number
}

const { data, refresh } = await useFetch<{ threads: ThreadRow[] }>('/api/threads')
const threads = computed(() => data.value?.threads || [])
const creating = ref(false)

async function createThread() {
  if (creating.value) return
  creating.value = true
  try {
    const r = await $fetch<{ id: string }>('/api/threads', { method: 'POST', body: {} })
    await navigateTo(`/threads/${r.id}`)
  } catch (error) {
    console.error('Failed to create thread', error)
  } finally {
    creating.value = false
  }
}

function modelLabel(model: string): string {
  return model.replace(/^openrouter\//, '').replace(/^anthropic\//, '').replace(/^google\//, '').replace(/^openai\//, '')
}

function formatRelative(value: string | null): string {
  if (!value) return ''
  return formatBrowserDate(value)
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('threads.title') }}</h1>
        <p class="text-sm text-text-soft">{{ t('threads.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="creating"
        @click="createThread"
      >
        <PlusIcon class="size-4" aria-hidden="true" />
        <span>{{ creating ? t('threads.creating') : t('threads.new') }}</span>
      </button>
    </header>

    <section v-if="threads.length" class="space-y-1.5">
      <NuxtLink
        v-for="thread in threads"
        :key="thread.id"
        :to="`/threads/${thread.id}`"
        class="group flex items-center gap-3 rounded-card border border-border-default bg-surface-1 px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <ChatBubbleLeftRightIcon class="size-5 shrink-0 text-muted group-hover:text-accent" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="truncate text-sm font-semibold text-text-strong">{{ thread.title }}</span>
            <span class="shrink-0 text-xs text-muted">{{ thread.message_count }} {{ thread.message_count === 1 ? t('threads.message') : t('threads.messages') }}</span>
          </div>
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{{ modelLabel(thread.model) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatRelative(thread.last_message_at || thread.updated_at) }}</span>
          </div>
        </div>
      </NuxtLink>
    </section>

    <section v-else class="rounded-card border border-dashed border-border-default p-8 text-center">
      <ChatBubbleLeftRightIcon class="mx-auto size-8 text-muted-soft" aria-hidden="true" />
      <p class="mt-3 text-sm text-text-strong">{{ t('threads.empty_title') }}</p>
      <p class="mt-1 text-xs text-muted">{{ t('threads.empty_hint') }}</p>
    </section>
  </div>
</template>
