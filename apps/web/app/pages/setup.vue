<script setup lang="ts">
import { CheckCircleIcon, ExclamationCircleIcon, SparklesIcon } from '@heroicons/vue/24/outline'

definePageMeta({ layout: 'empty' })

interface SetupStatus {
  completed: boolean
  checks: {
    session_secret: boolean
    password_hash: boolean
    embedding_provider: boolean
  }
}

const { data, refresh } = await useFetch<SetupStatus>('/api/setup/status')
const embeddingTest = ref<{ ok: boolean, provider: string, dim: number, model?: string | null } | null>(null)
const finishing = ref(false)

async function testEmbedding() {
  embeddingTest.value = await $fetch('/api/setup/test-embedding', { method: 'POST' })
}

async function finish() {
  finishing.value = true
  try {
    await $fetch('/api/setup/complete', {
      method: 'POST',
      body: {
        embedding_ok: embeddingTest.value?.ok || null,
        mail_configured: false
      }
    })
    await navigateTo('/')
  } finally {
    finishing.value = false
  }
}

onMounted(async () => {
  if (data.value?.completed) {
    await navigateTo('/')
  }
  await refresh()
})

const checks = computed(() => data.value?.checks)
const sessionOk = computed(() => Boolean(checks.value?.session_secret))
const passwordOk = computed(() => Boolean(checks.value?.password_hash))
</script>

<template>
  <main class="setup-wizard">
    <header class="setup-wizard-head">
      <SparklesIcon class="size-6 text-blue-600" aria-hidden="true" />
      <h1>Welcome to BKOS</h1>
      <p class="muted">A few quick checks before you go.</p>
    </header>

    <ol class="setup-wizard-steps">
      <li>
        <h2>
          <component :is="sessionOk ? CheckCircleIcon : ExclamationCircleIcon" class="size-5" :class="sessionOk ? 'text-emerald-600' : 'text-amber-600'" aria-hidden="true" />
          <span>Session secret</span>
        </h2>
        <p v-if="sessionOk">A strong <code>SESSION_SECRET</code> is configured.</p>
        <p v-else>
          Generate one with <code>openssl rand -base64 48</code> and set
          <code>SESSION_SECRET</code> in your <code>.env</code>, then restart BKOS.
          The server refuses to boot without it, so if you're seeing this page
          something is unexpected.
        </p>
      </li>

      <li>
        <h2>
          <component :is="passwordOk ? CheckCircleIcon : ExclamationCircleIcon" class="size-5" :class="passwordOk ? 'text-emerald-600' : 'text-amber-600'" aria-hidden="true" />
          <span>Admin password</span>
        </h2>
        <p v-if="passwordOk">A hashed password is set for <code>BKOS_USERNAME</code>.</p>
        <p v-else>
          Run <code>pnpm setup:password</code> to generate
          <code>BKOS_PASSWORD_HASH</code>, paste it into <code>.env</code>, restart.
        </p>
      </li>

      <li>
        <h2>
          <component :is="embeddingTest?.ok ? CheckCircleIcon : ExclamationCircleIcon" class="size-5" :class="embeddingTest?.ok ? 'text-emerald-600' : 'text-slate-400'" aria-hidden="true" />
          <span>Embeddings (optional)</span>
        </h2>
        <p v-if="!embeddingTest">
          Without an embedding provider, search falls back to lexical-only and
          entity-link suggestions are disabled. Click below to test the
          configured provider.
        </p>
        <p v-else-if="embeddingTest.ok">
          <code>{{ embeddingTest.provider }}</code> returned a {{ embeddingTest.dim }}-dim vector
          ({{ embeddingTest.model || 'default model' }}).
        </p>
        <p v-else class="error">
          Provider <code>{{ embeddingTest.provider }}</code> didn't return a vector.
          Re-check <code>BKOS_EMBEDDING_PROVIDER</code> and
          <code>BKOS_EMBEDDING_MODEL</code>, then re-run the test.
        </p>
        <button type="button" class="settings-secondary" @click="testEmbedding">Run test</button>
      </li>

      <li>
        <h2>
          <SparklesIcon class="size-5 text-slate-400" aria-hidden="true" />
          <span>Optional follow-ups</span>
        </h2>
        <ul class="setup-followups">
          <li>Enable 2FA from <NuxtLink to="/settings">Settings → Security</NuxtLink>.</li>
          <li>Generate an API key in Settings → API keys to use the bookmarklet.</li>
          <li>Point IMAP at BKOS via the <code>MAIL_*</code> env vars (see docs/email-setup.md).</li>
        </ul>
      </li>
    </ol>

    <button class="settings-primary setup-wizard-finish" :disabled="finishing" @click="finish">
      {{ finishing ? 'Finishing…' : 'Finish setup' }}
    </button>
  </main>
</template>
