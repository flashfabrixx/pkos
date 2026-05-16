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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Settings</p>
            <h1>Webhooks</h1>
          </div>
        </div>

        <p>
          BKOS POSTs a JSON payload to each subscribed URL when events occur.
          Verify deliveries via the <code>X-BKOS-Signature: sha256=…</code>
          header (HMAC-SHA-256 of the body, keyed by the secret shown once
          at creation).
        </p>

        <div v-if="newlyCreatedSecret" class="settings-backup-codes">
          <h3>Secret for {{ newlyCreatedSecret.url }}</h3>
          <p class="muted">Shown once. Store it before navigating away.</p>
          <pre class="settings-backup-list">{{ newlyCreatedSecret.secret }}</pre>
          <button type="button" class="settings-primary" @click="newlyCreatedSecret = null">Done</button>
        </div>

        <form class="settings-api-key-create" @submit.prevent="createSubscription">
          <label>
            Destination URL
            <input v-model="newUrl" type="url" required placeholder="https://example.com/hook">
          </label>
          <button type="submit" class="settings-primary" :disabled="creating || !newUrl">
            <PlusIcon class="size-4" aria-hidden="true" />
            {{ creating ? 'Creating…' : 'Add subscription' }}
          </button>
        </form>
        <div class="search-facet-row">
          <span class="search-facet-label">Events</span>
          <button
            v-for="kind in EVENT_TYPES"
            :key="kind"
            type="button"
            class="search-facet-chip"
            :class="{ 'is-active': newEvents.has(kind) }"
            @click="toggleEvent(kind)"
          >{{ kind }}</button>
          <span class="muted">(empty = all events)</span>
        </div>
        <p v-if="errMsg" class="error">{{ errMsg }}</p>

        <ul v-if="subscriptions.length" class="settings-api-key-list">
          <li v-for="sub in subscriptions" :key="sub.id" class="settings-api-key-row" :class="{ 'is-revoked': !sub.active }">
            <div class="settings-api-key-main">
              <GlobeAltIcon class="size-4 text-slate-500" aria-hidden="true" />
              <strong>{{ sub.url }}</strong>
              <span class="muted">{{ sub.events.length ? sub.events.join(' · ') : 'all events' }}</span>
              <span v-if="!sub.active" class="settings-api-key-revoked">disabled</span>
            </div>
            <div class="settings-api-key-meta">
              <span class="muted">last status {{ sub.last_status ?? '–' }}</span>
              <span v-if="sub.last_delivered_at" class="muted">last {{ formatBrowserDate(sub.last_delivered_at) }}</span>
            </div>
            <button type="button" class="settings-api-key-revoke" @click="remove(sub.id)">
              <TrashIcon class="size-4" aria-hidden="true" />
              <span>Remove</span>
            </button>
          </li>
        </ul>
        <p v-else class="muted">No webhook subscriptions yet.</p>
      </section>
    </main>
  </div>
</template>
