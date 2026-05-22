<script setup lang="ts">
import {
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperAirplaneIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

interface MessageRow {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: SourceRow[] | null
  model?: string | null
  provider?: string | null
  created_at?: string
  /** Local-only: true while assistant tokens are streaming in. */
  streaming?: boolean
}

interface SourceRow {
  documentId: string
  title: string
  sourceType: string
  capturedAt: string | null
  excerpt: string
  score: number | null
}

interface ThreadRow {
  id: string
  title: string
  model: string
  system_prompt: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  archived_at: string | null
}

const SUPPORTED_MODELS = [
  { value: 'openrouter/anthropic/claude-haiku-4-5', label: 'Haiku 4.5 (fast, cheap)' },
  { value: 'openrouter/anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6 (balanced)' },
  { value: 'openrouter/anthropic/claude-opus-4-7', label: 'Opus 4.7 (deep)' },
  { value: 'openrouter/google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (cheap)' },
  { value: 'openrouter/openai/gpt-4.1-mini', label: 'GPT-4.1 mini (fallback)' }
]

const { t } = useI18n()
const route = useRoute()

const thread = ref<ThreadRow | null>(null)
const messages = ref<MessageRow[]>([])
const expandedSources = ref<Set<string>>(new Set())
const draft = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const { data: initial } = await useFetch<{ thread: ThreadRow, messages: MessageRow[] }>(`/api/threads/${route.params.id}`)
watch(initial, (value) => {
  thread.value = value?.thread || null
  messages.value = (value?.messages || []).map((m) => ({ ...m }))
  void nextTick(scrollToBottom)
}, { immediate: true })

useHead({ title: () => thread.value?.title || 'Thread' })

function scrollToBottom() {
  const el = scroller.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function toggleSources(id: string) {
  if (expandedSources.value.has(id)) expandedSources.value.delete(id)
  else expandedSources.value.add(id)
}

async function updateModel(next: string) {
  if (!thread.value || thread.value.model === next) return
  const previous = thread.value.model
  thread.value.model = next
  try {
    await $fetch(`/api/threads/${thread.value.id}`, { method: 'PATCH', body: { model: next } })
  } catch (error) {
    thread.value.model = previous
    console.error('Failed to set model', error)
  }
}

async function renameThread(next: string) {
  if (!thread.value || !next.trim() || thread.value.title === next.trim()) return
  const previous = thread.value.title
  thread.value.title = next.trim()
  try {
    await $fetch(`/api/threads/${thread.value.id}`, { method: 'PATCH', body: { title: next.trim() } })
  } catch (error) {
    thread.value.title = previous
    console.error('Failed to rename thread', error)
  }
}

async function deleteThread() {
  if (!thread.value) return
  if (!window.confirm(t('threads.delete_confirm'))) return
  try {
    await $fetch(`/api/threads/${thread.value.id}`, { method: 'DELETE' })
    await navigateTo('/threads')
  } catch (error) {
    console.error('Failed to delete thread', error)
  }
}

async function sendMessage() {
  if (sending.value || !thread.value) return
  const content = draft.value.trim()
  if (!content) return
  sending.value = true
  draft.value = ''
  const localId = `local-${Date.now()}`

  // Render the user turn immediately + an empty assistant bubble that
  // will fill in as tokens arrive.
  messages.value.push({ id: `${localId}-user`, role: 'user', content })
  const assistantIndex = messages.value.length
  messages.value.push({ id: `${localId}-assistant`, role: 'assistant', content: '', sources: [], streaming: true })
  await nextTick(scrollToBottom)

  try {
    const response = await fetch(`/api/threads/${thread.value.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ content })
    })
    if (!response.ok || !response.body) {
      throw new Error(`stream failed: ${response.status}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          try {
            const payload = data ? JSON.parse(data) : null
            handleStreamEvent(currentEvent, payload, assistantIndex)
            await nextTick(scrollToBottom)
          } catch (error) {
            console.error('Bad SSE payload', error, data)
          }
        }
      }
    }
  } catch (error) {
    console.error('Send failed', error)
    const target = messages.value[assistantIndex]
    if (target) {
      target.content = target.content || '(no response — connection failed)'
      target.streaming = false
    }
  } finally {
    sending.value = false
    void nextTick(() => inputEl.value?.focus())
  }
}

function handleStreamEvent(name: string, payload: any, assistantIndex: number) {
  const target = messages.value[assistantIndex]
  if (!target) return
  switch (name) {
    case 'user':
      // First user-event update with the persisted id.
      if (messages.value[assistantIndex - 1]) {
        messages.value[assistantIndex - 1]!.id = payload?.id
        messages.value[assistantIndex - 1]!.created_at = payload?.createdAt
      }
      break
    case 'sources':
      target.sources = Array.isArray(payload) ? payload : []
      break
    case 'token':
      if (payload?.delta) target.content += payload.delta
      break
    case 'done':
      target.id = payload?.messageId || target.id
      target.model = payload?.model || null
      target.provider = payload?.provider || null
      target.streaming = false
      if (payload?.title && thread.value) thread.value.title = payload.title
      break
    case 'error':
      target.content = target.content || `(${payload?.message || 'error'})`
      target.streaming = false
      break
  }
}

function onEnterKey(event: KeyboardEvent) {
  if (event.shiftKey) return
  event.preventDefault()
  void sendMessage()
}

function modelLabel(model: string | null | undefined): string {
  if (!model) return ''
  return model.replace(/^openrouter\//, '').replace(/^anthropic\//, '').replace(/^google\//, '').replace(/^openai\//, '')
}
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto]">
    <header class="flex items-center gap-3 border-b border-border-subtle bg-surface-1 px-6 py-3">
      <NuxtLink to="/threads" class="text-xs text-muted hover:text-text">← {{ t('threads.title') }}</NuxtLink>
      <input
        v-if="thread"
        :value="thread.title"
        class="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-semibold text-text-strong outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2"
        :aria-label="t('threads.rename')"
        @change="(e) => renameThread((e.target as HTMLInputElement).value)"
      >
      <select
        v-if="thread"
        :value="thread.model"
        class="rounded-md border border-border-default bg-surface-1 px-2 py-1 text-xs text-text outline-none focus:border-accent"
        :aria-label="t('threads.model')"
        @change="(e) => updateModel((e.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in SUPPORTED_MODELS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
        :aria-label="t('threads.delete')"
        :title="t('threads.delete')"
        @click="deleteThread"
      >
        <TrashIcon class="size-4" aria-hidden="true" />
      </button>
    </header>

    <main ref="scroller" class="overflow-y-auto bg-app">
      <div class="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
        <template v-for="(msg, i) in messages" :key="msg.id || `idx-${i}`">
          <article
            :class="[
              'flex flex-col gap-2',
              msg.role === 'user' ? 'items-end' : 'items-start'
            ]"
          >
            <div
              :class="[
                'max-w-[85%] rounded-card px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-accent-soft text-text-strong'
                  : 'bg-surface-1 text-text border border-border-subtle'
              ]"
            >
              <span>{{ msg.content }}</span>
              <span v-if="msg.streaming" class="inline-block size-2 translate-y-[-1px] animate-pulse rounded-full bg-accent ml-1" aria-hidden="true" />
            </div>
            <div v-if="msg.role === 'assistant' && (msg.sources?.length || msg.model)" class="flex flex-wrap items-center gap-2 text-xs text-muted">
              <button
                v-if="msg.sources && msg.sources.length"
                type="button"
                class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-text"
                @click="toggleSources(msg.id || `idx-${i}`)"
              >
                <component :is="expandedSources.has(msg.id || `idx-${i}`) ? ChevronUpIcon : ChevronDownIcon" class="size-3" aria-hidden="true" />
                <span>{{ msg.sources.length }} {{ msg.sources.length === 1 ? t('threads.source') : t('threads.sources') }}</span>
              </button>
              <span v-if="msg.model">{{ modelLabel(msg.model) }}</span>
            </div>
            <div
              v-if="msg.role === 'assistant' && expandedSources.has(msg.id || `idx-${i}`) && msg.sources?.length"
              class="w-full max-w-[85%] space-y-1.5"
            >
              <NuxtLink
                v-for="(src, sidx) in msg.sources"
                :key="src.documentId + sidx"
                :to="`/documents/${src.documentId}`"
                class="block rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <div class="flex items-baseline gap-2">
                  <span class="font-semibold">[doc-{{ sidx + 1 }}]</span>
                  <span class="truncate">{{ src.title }}</span>
                  <span v-if="src.capturedAt" class="ml-auto shrink-0 text-muted">{{ src.capturedAt }}</span>
                </div>
                <p v-if="src.excerpt" class="mt-1 line-clamp-2 text-muted">{{ src.excerpt }}</p>
              </NuxtLink>
            </div>
          </article>
        </template>

        <div v-if="!messages.length" class="rounded-card border border-dashed border-border-default p-8 text-center">
          <ChatBubbleLeftRightIcon class="mx-auto size-8 text-muted-soft" aria-hidden="true" />
          <p class="mt-3 text-sm text-text-strong">{{ t('threads.empty_chat_title') }}</p>
          <p class="mt-1 text-xs text-muted">{{ t('threads.empty_chat_hint') }}</p>
        </div>
      </div>
    </main>

    <footer class="border-t border-border-subtle bg-surface-1 px-6 py-3">
      <form class="mx-auto flex w-full max-w-3xl items-end gap-3" @submit.prevent="sendMessage">
        <textarea
          ref="inputEl"
          v-model="draft"
          :placeholder="t('threads.input_placeholder')"
          rows="2"
          class="block w-full resize-none rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          :disabled="sending"
          @keydown.enter="onEnterKey"
        />
        <button
          type="submit"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="sending || !draft.trim()"
          :aria-label="t('threads.send')"
        >
          <PaperAirplaneIcon class="size-4" aria-hidden="true" />
        </button>
      </form>
    </footer>
  </div>
</template>
