<script setup lang="ts">
import { GlobeAltIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('settings.page_title_webhooks') })

interface Subscription {
  id: string
  url: string
  events: string[]
  active: boolean
  last_status: number | null
  last_delivered_at: string | null
  created_at: string
}

const EVENT_TYPES = ['capture.created', 'capture.processed', 'action.created', 'action.completed', 'entity.merged'] as const

const { data, refresh } = await useFetch<{ subscriptions: Subscription[] }>('/api/settings/webhooks')
const subscriptions = computed(() => data.value?.subscriptions || [])

const newUrl = ref('')
const newEvents = ref<Set<string>>(new Set())
const newlyCreatedSecret = ref<{ url: string, secret: string } | null>(null)
const creating = ref(false)
const errMsg = ref<string | null>(null)

function toggleEvent(name: string) {
  if (newEvents.value.has(name)) newEvents.value.delete(name)
  else newEvents.value.add(name)
  newEvents.value = new Set(newEvents.value)
}

async function createSubscription() {
  creating.value = true
  errMsg.value = null
  try {
    const result = await $fetch<{ url: string, secret: string }>('/api/settings/webhooks', {
      method: 'POST',
      body: { url: newUrl.value, events: [...newEvents.value] }
    })
    newlyCreatedSecret.value = result
    newUrl.value = ''
    newEvents.value = new Set()
    await refresh()
  } catch (e: any) {
    errMsg.value = e?.data?.statusMessage || e?.message || 'Failed'
  } finally {
    creating.value = false
  }
}

async function remove(id: string) {
  if (!confirm('Remove this webhook subscription?')) return
  await $fetch(`/api/settings/webhooks/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <main class="mx-auto grid max-w-3xl gap-4 p-5">
    <section class="space-y-4 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header>
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">Settings</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">Webhooks</h1>
      </header>

      <p class="text-sm text-text-soft">
        BKOS POSTs a JSON payload to each subscribed URL when events occur.
        Verify deliveries via the <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">X-BKOS-Signature: sha256=…</code>
        header (HMAC-SHA-256 of the body, keyed by the secret shown once at creation).
      </p>

      <div v-if="newlyCreatedSecret" class="space-y-3 rounded-card border border-warning-border bg-warning-soft p-4">
        <h3 class="text-sm font-semibold text-warning">Secret for {{ newlyCreatedSecret.url }}</h3>
        <p class="text-xs text-text-soft">Shown once. Store it before navigating away.</p>
        <pre class="overflow-auto rounded-card bg-surface-1 p-3 font-mono text-xs leading-relaxed text-text">{{ newlyCreatedSecret.secret }}</pre>
        <div class="flex justify-end">
          <UiButton size="sm" @click="newlyCreatedSecret = null">Done</UiButton>
        </div>
      </div>

      <form class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" @submit.prevent="createSubscription">
        <UiField label="Destination URL" required>
          <template #default="{ id }">
            <UiInput :id="id" v-model="newUrl" type="url" required placeholder="https://example.com/hook" />
          </template>
        </UiField>
        <UiButton type="submit" :loading="creating" :disabled="!newUrl">
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ creating ? 'Creating…' : 'Add subscription' }}
        </UiButton>
      </form>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">Events</span>
        <button
          v-for="kind in EVENT_TYPES"
          :key="kind"
          type="button"
          :class="[
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
            newEvents.has(kind)
              ? 'bg-accent text-accent-fg'
              : 'bg-soft text-text-soft hover:bg-surface-3'
          ]"
          @click="toggleEvent(kind)"
        >{{ kind }}</button>
        <span class="text-xs text-muted">(empty = all events)</span>
      </div>
      <p v-if="errMsg" class="text-xs text-danger">{{ errMsg }}</p>

      <ul v-if="subscriptions.length" class="divide-y divide-border-subtle">
        <li
          v-for="sub in subscriptions"
          :key="sub.id"
          :class="['flex flex-wrap items-center gap-3 py-3', !sub.active && 'opacity-60']"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex flex-wrap items-center gap-2">
              <GlobeAltIcon class="size-4 text-muted" aria-hidden="true" />
              <strong class="truncate text-sm text-text-strong">{{ sub.url }}</strong>
              <span class="text-xs text-muted">{{ sub.events.length ? sub.events.join(' · ') : 'all events' }}</span>
              <UiBadge v-if="!sub.active" variant="danger">disabled</UiBadge>
            </div>
            <div class="flex flex-wrap gap-3 text-xs text-muted">
              <span>last status {{ sub.last_status ?? '–' }}</span>
              <span v-if="sub.last_delivered_at">last {{ formatBrowserDate(sub.last_delivered_at) }}</span>
            </div>
          </div>
          <UiButton variant="ghost" size="sm" @click="remove(sub.id)">
            <TrashIcon class="size-4" aria-hidden="true" />
            Remove
          </UiButton>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No webhook subscriptions yet.</p>
    </section>
  </main>
</template>
