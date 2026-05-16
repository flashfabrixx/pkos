<script setup lang="ts">
import { CheckCircleIcon, ExclamationCircleIcon, SparklesIcon } from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

definePageMeta({ layout: 'empty' })

const { t: _t } = useI18n()
// 'setup.title' is "Welcome to BKOS" for the page heading; for the tab
// we want a shorter, non-duplicating label.
useHead({ title: 'Setup' })

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
  embeddingTest.value = await $fetch<typeof embeddingTest.value>('/api/setup/test-embedding', { method: 'POST' })
}

async function finish() {
  finishing.value = true
  try {
    const body: { embedding_ok?: boolean, mail_configured: boolean } = { mail_configured: false }
    if (embeddingTest.value) body.embedding_ok = embeddingTest.value.ok
    await $fetch('/api/setup/complete', { method: 'POST', body })
    await navigateTo('/login')
  } finally {
    finishing.value = false
  }
}

onMounted(async () => {
  if (data.value?.completed) {
    await navigateTo('/login')
  }
  await refresh()
})

const checks = computed(() => data.value?.checks)
const sessionOk = computed(() => Boolean(checks.value?.session_secret))
const passwordOk = computed(() => Boolean(checks.value?.password_hash))
</script>

<template>
  <main class="mx-auto grid min-h-screen w-full max-w-2xl gap-6 px-6 py-12">
    <header class="space-y-2 text-center">
      <SparklesIcon class="mx-auto size-6 text-accent" aria-hidden="true" />
      <h1 class="text-2xl font-semibold tracking-tight text-text-strong">Welcome to BKOS</h1>
      <p class="text-sm text-muted">A few quick checks before you go.</p>
    </header>

    <ol class="grid gap-3">
      <li class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <component
            :is="sessionOk ? CheckCircleIcon : ExclamationCircleIcon"
            :class="['size-5', sessionOk ? 'text-success' : 'text-warning']"
            aria-hidden="true"
          />
          <span>Session secret</span>
        </h2>
        <p v-if="sessionOk" class="mt-2 text-sm text-text-soft">A strong <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">SESSION_SECRET</code> is configured.</p>
        <p v-else class="mt-2 text-sm text-text-soft">
          Generate one with <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">openssl rand -base64 48</code> and set
          <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">SESSION_SECRET</code> in your <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">.env</code>, then restart BKOS.
        </p>
      </li>

      <li class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <component
            :is="passwordOk ? CheckCircleIcon : ExclamationCircleIcon"
            :class="['size-5', passwordOk ? 'text-success' : 'text-warning']"
            aria-hidden="true"
          />
          <span>Admin password</span>
        </h2>
        <p v-if="passwordOk" class="mt-2 text-sm text-text-soft">A hashed password is set for <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">BKOS_USERNAME</code>.</p>
        <p v-else class="mt-2 text-sm text-text-soft">
          Run <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">pnpm bkos:hash-password</code> to generate
          <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">BKOS_PASSWORD_HASH</code>, paste it into <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">.env</code>, restart.
        </p>
      </li>

      <li class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <component
            :is="embeddingTest?.ok ? CheckCircleIcon : ExclamationCircleIcon"
            :class="['size-5', embeddingTest?.ok ? 'text-success' : 'text-muted-soft']"
            aria-hidden="true"
          />
          <span>Embeddings (optional)</span>
        </h2>
        <p v-if="!embeddingTest" class="mt-2 text-sm text-text-soft">
          Without an embedding provider, search falls back to lexical-only and
          entity-link suggestions are disabled. Click below to test the configured provider.
        </p>
        <p v-else-if="embeddingTest.ok" class="mt-2 text-sm text-text-soft">
          <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">{{ embeddingTest.provider }}</code>
          returned a {{ embeddingTest.dim }}-dim vector ({{ embeddingTest.model || 'default model' }}).
        </p>
        <p v-else class="mt-2 text-sm text-danger">
          Provider <code class="rounded bg-danger-soft px-1 py-0.5 font-mono text-xs">{{ embeddingTest.provider }}</code> didn't return a vector.
          Re-check <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">BKOS_EMBEDDING_PROVIDER</code> and
          <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">BKOS_EMBEDDING_MODEL</code>, then re-run the test.
        </p>
        <UiButton variant="secondary" size="sm" class="mt-3" @click="testEmbedding">Run test</UiButton>
      </li>

      <li class="rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-text-strong">
          <SparklesIcon class="size-5 text-muted-soft" aria-hidden="true" />
          <span>Optional follow-ups</span>
        </h2>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-text-soft">
          <li>Enable 2FA from <NuxtLink class="text-accent hover:underline" to="/settings">Settings → Security</NuxtLink>.</li>
          <li>Generate an API key in Settings → API keys to use the bookmarklet.</li>
          <li>Point IMAP at BKOS via the <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs">MAIL_*</code> env vars (see docs/email-setup.md).</li>
        </ul>
      </li>
    </ol>

    <UiButton :loading="finishing" block @click="finish">
      {{ finishing ? 'Finishing…' : 'Finish setup' }}
    </UiButton>
  </main>
</template>
