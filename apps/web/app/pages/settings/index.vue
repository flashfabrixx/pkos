<script setup lang="ts">
import {
  ComputerDesktopIcon,
  KeyIcon,
  LanguageIcon,
  MoonIcon,
  PaintBrushIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  SunIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useHead({ title: () => t('settings.title') })
const { choice: themeChoice, apply: applyTheme } = useTheme()
const { locale, setLocale, available: localeOptions } = useLocaleSwitch()

const THEME_OPTIONS = [
  { value: 'system' as const, icon: ComputerDesktopIcon },
  { value: 'light' as const, icon: SunIcon },
  { value: 'dark' as const, icon: MoonIcon }
]

const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'Deutsch'
}

interface Status {
  enabled: boolean
  enabled_at: string | null
  backup_codes_remaining: number
  backup_codes_total: number
}

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  actor: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

const { data, refresh } = await useFetch<Status>('/api/auth/2fa/status')

const { data: keysData, refresh: refreshKeys } = await useFetch<{ keys: ApiKeyRow[] }>('/api/settings/api-keys')
const apiKeys = computed(() => keysData.value?.keys || [])
const newKeyName = ref('')
const creating = ref(false)
const newlyCreated = ref<{ name: string, plaintext: string } | null>(null)
const keysError = ref<string | null>(null)

async function createApiKey() {
  if (!newKeyName.value.trim()) return
  creating.value = true
  keysError.value = null
  try {
    const result = await $fetch<{ name: string, plaintext: string }>('/api/settings/api-keys', {
      method: 'POST',
      body: { name: newKeyName.value.trim() }
    })
    newlyCreated.value = { name: result.name, plaintext: result.plaintext }
    newKeyName.value = ''
    await refreshKeys()
  } catch (error: any) {
    keysError.value = error?.data?.statusMessage || error?.message || 'Failed to create key'
  } finally {
    creating.value = false
  }
}

async function revokeApiKey(id: string) {
  if (!confirm('Revoke this API key? Applications using it will start failing immediately.')) return
  try {
    await $fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' })
    await refreshKeys()
  } catch (error) {
    console.error('Failed to revoke key', error)
  }
}

function copyToClipboard(value: string) {
  navigator.clipboard?.writeText(value)
}

function dismissCreated() {
  newlyCreated.value = null
}

const phase = ref<'idle' | 'enrolling' | 'verifying' | 'showing-backup-codes'>('idle')
const enrollSecret = ref('')
const enrollUri = ref('')
const enrollCode = ref('')
const backupCodes = ref<string[]>([])
const disablePassword = ref('')
const error = ref<string | null>(null)
const pending = ref(false)

async function startEnroll() {
  error.value = null
  pending.value = true
  try {
    const res = await $fetch<{ secret: string, otpauth_uri: string }>('/api/auth/2fa/enroll', { method: 'POST' })
    enrollSecret.value = res.secret
    enrollUri.value = res.otpauth_uri
    enrollCode.value = ''
    phase.value = 'verifying'
  } catch (e: any) {
    error.value = e?.statusMessage || 'Failed to start enrollment'
  } finally {
    pending.value = false
  }
}

async function verifyEnroll() {
  error.value = null
  pending.value = true
  try {
    const res = await $fetch<{ enabled: boolean, backup_codes: string[] }>(
      '/api/auth/2fa/verify-enroll',
      { method: 'POST', body: { secret: enrollSecret.value, code: enrollCode.value.trim() } }
    )
    backupCodes.value = res.backup_codes
    phase.value = 'showing-backup-codes'
    await refresh()
  } catch (e: any) {
    error.value = e?.statusMessage || 'Verification failed'
  } finally {
    pending.value = false
  }
}

async function disable() {
  error.value = null
  pending.value = true
  try {
    await $fetch('/api/auth/2fa/disable', { method: 'POST', body: { password: disablePassword.value } })
    disablePassword.value = ''
    phase.value = 'idle'
    await refresh()
  } catch (e: any) {
    error.value = e?.statusMessage || 'Failed to disable'
  } finally {
    pending.value = false
  }
}

function cancelEnroll() {
  phase.value = 'idle'
  enrollSecret.value = ''
  enrollUri.value = ''
  enrollCode.value = ''
  error.value = null
}

function finishBackupCodes() {
  backupCodes.value = []
  phase.value = 'idle'
}

function copyBackupCodes() {
  navigator.clipboard?.writeText(backupCodes.value.join('\n'))
}
</script>

<template>
  <main class="mx-auto grid max-w-3xl gap-4 p-5">
    <header>
      <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">{{ t('settings.eyebrow') }}</p>
      <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('settings.title') }}</h1>
    </header>

    <section class="space-y-3 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="flex items-start gap-3">
        <PaintBrushIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <h2 class="text-sm font-semibold text-text-strong">Appearance</h2>
          <p class="text-xs text-muted">Light, dark, or follow the operating system.</p>
        </div>
      </header>
      <div class="inline-flex gap-1 rounded-md border border-border-default bg-surface-2 p-1">
        <button
          v-for="opt in THEME_OPTIONS"
          :key="opt.value"
          type="button"
          :class="[
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            themeChoice === opt.value
              ? 'border border-border-default bg-surface-1 text-text shadow-card'
              : 'border border-transparent text-text-soft hover:text-text'
          ]"
          @click="applyTheme(opt.value)"
        >
          <component :is="opt.icon" class="size-4" aria-hidden="true" />
          <span>{{ t(`common.${opt.value}`) }}</span>
        </button>
      </div>
    </section>

    <section class="space-y-3 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="flex items-start gap-3">
        <LanguageIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <h2 class="text-sm font-semibold text-text-strong">Language</h2>
          <p class="text-xs text-muted">Display language for the BKOS interface.</p>
        </div>
      </header>
      <div class="inline-flex gap-1 rounded-md border border-border-default bg-surface-2 p-1">
        <button
          v-for="code in localeOptions"
          :key="code"
          type="button"
          :class="[
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            locale === code
              ? 'border border-border-default bg-surface-1 text-text shadow-card'
              : 'border border-transparent text-text-soft hover:text-text'
          ]"
          @click="setLocale(code)"
        >
          <span class="font-mono text-[11px] font-bold tracking-wider">{{ code.toUpperCase() }}</span>
          <span>{{ LOCALE_LABELS[code] || code }}</span>
        </button>
      </div>
    </section>

    <section class="space-y-4 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="flex items-start gap-3">
        <component
          :is="data?.enabled ? ShieldCheckIcon : ShieldExclamationIcon"
          :class="['size-5 shrink-0', data?.enabled ? 'text-success' : 'text-warning']"
          aria-hidden="true"
        />
        <div>
          <h2 class="text-sm font-semibold text-text-strong">Two-factor authentication</h2>
          <p class="text-xs text-muted">{{ data?.enabled ? 'Enabled — your account asks for a 6-digit code at login.' : 'Disabled — only a password protects your account.' }}</p>
        </div>
      </header>

      <div v-if="data?.enabled" class="space-y-3">
        <p class="text-sm text-text">Backup codes left: <strong>{{ data.backup_codes_remaining }} / {{ data.backup_codes_total }}</strong></p>
        <form class="space-y-3" @submit.prevent="disable">
          <UiField label="Current password (required to disable 2FA)">
            <template #default="{ id }">
              <UiInput :id="id" v-model="disablePassword" type="password" autocomplete="current-password" />
            </template>
          </UiField>
          <p v-if="error" class="text-xs text-danger">{{ error }}</p>
          <UiButton type="submit" variant="danger" size="sm" :disabled="!disablePassword" :loading="pending">
            {{ pending ? 'Disabling…' : 'Disable two-factor' }}
          </UiButton>
        </form>
      </div>

      <div v-else-if="phase === 'idle'" class="space-y-3">
        <p class="text-sm text-text-soft">Protect your BKOS account with an authenticator app (1Password, Authy, Google Authenticator, etc.).</p>
        <UiButton :loading="pending" @click="startEnroll">
          {{ pending ? 'Working…' : 'Enable two-factor' }}
        </UiButton>
        <p v-if="error" class="text-xs text-danger">{{ error }}</p>
      </div>

      <div v-else-if="phase === 'verifying'" class="space-y-3">
        <ol class="list-decimal space-y-2 pl-5 text-sm text-text-soft">
          <li>Open your authenticator app and add a new entry.</li>
          <li>
            Scan the QR by pasting this URI, or enter the secret manually:
            <code class="mt-1 block break-all rounded bg-soft p-2 font-mono text-xs text-text">{{ enrollUri }}</code>
            <p class="mt-1 text-xs text-muted">Secret: <code class="rounded bg-soft px-1 py-0.5 font-mono">{{ enrollSecret }}</code></p>
          </li>
          <li>Enter the current 6-digit code from your authenticator below.</li>
        </ol>
        <form class="space-y-3" @submit.prevent="verifyEnroll">
          <UiField label="6-digit code">
            <template #default="{ id }">
              <UiInput
                :id="id"
                v-model="enrollCode"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="123 456"
                autofocus
              />
            </template>
          </UiField>
          <p v-if="error" class="text-xs text-danger">{{ error }}</p>
          <div class="flex justify-end gap-2">
            <UiButton type="button" variant="secondary" size="sm" @click="cancelEnroll">Cancel</UiButton>
            <UiButton type="submit" size="sm" :disabled="enrollCode.length !== 6" :loading="pending">
              {{ pending ? 'Verifying…' : 'Confirm and enable' }}
            </UiButton>
          </div>
        </form>
      </div>

      <div v-else-if="phase === 'showing-backup-codes'" class="space-y-3">
        <h3 class="text-sm font-semibold text-text-strong">Save your backup codes</h3>
        <p class="text-xs text-muted">Each code works once. Use one if you lose access to your authenticator. Store them somewhere safe — they will not be shown again.</p>
        <pre class="overflow-auto rounded-card bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text">{{ backupCodes.join('\n') }}</pre>
        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="secondary" size="sm" @click="copyBackupCodes">Copy to clipboard</UiButton>
          <UiButton type="button" size="sm" @click="finishBackupCodes">I've saved them</UiButton>
        </div>
      </div>
    </section>

    <section class="space-y-4 rounded-card border border-border-default bg-surface-1 p-5 shadow-card">
      <header class="flex items-start gap-3">
        <KeyIcon class="size-5 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <h2 class="text-sm font-semibold text-text-strong">API keys</h2>
          <p class="text-xs text-muted">Programmatic access for the BKOS REST API at <code class="rounded bg-soft px-1 py-0.5 font-mono text-[11px]">/api/v1/*</code>. Use as <code class="rounded bg-soft px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer &lt;key&gt;</code>.</p>
        </div>
      </header>

      <div v-if="newlyCreated" class="space-y-3 rounded-card border border-warning-border bg-warning-soft p-4">
        <h3 class="text-sm font-semibold text-warning">New key created — copy it now</h3>
        <p class="text-xs text-text-soft">This is the only time the full key is shown. Store it in your secrets manager.</p>
        <pre class="overflow-auto rounded-card bg-surface-1 p-3 font-mono text-xs leading-relaxed text-text">{{ newlyCreated.plaintext }}</pre>
        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="secondary" size="sm" @click="copyToClipboard(newlyCreated!.plaintext)">Copy</UiButton>
          <UiButton type="button" size="sm" @click="dismissCreated">Done</UiButton>
        </div>
      </div>

      <form class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" @submit.prevent="createApiKey">
        <UiField label="Key name">
          <template #default="{ id }">
            <UiInput :id="id" v-model="newKeyName" type="text" maxlength="120" placeholder="e.g. Shortcuts iPhone" />
          </template>
        </UiField>
        <UiButton type="submit" :disabled="!newKeyName.trim()" :loading="creating">
          <PlusIcon class="size-4" aria-hidden="true" />
          {{ creating ? 'Creating…' : 'Create key' }}
        </UiButton>
        <p v-if="keysError" class="text-xs text-danger sm:col-span-2">{{ keysError }}</p>
      </form>

      <ul v-if="apiKeys.length" class="divide-y divide-border-subtle">
        <li
          v-for="key in apiKeys"
          :key="key.id"
          :class="['flex flex-wrap items-center gap-3 py-3', key.revoked_at && 'opacity-60']"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex flex-wrap items-baseline gap-2">
              <strong class="text-sm text-text-strong">{{ key.name }}</strong>
              <code class="rounded bg-soft px-1 py-0.5 font-mono text-xs text-text-soft">bkos_{{ key.prefix }}_…</code>
              <span class="text-xs text-muted">{{ key.scopes.join(' · ') }}</span>
              <UiBadge v-if="key.revoked_at" variant="danger">revoked</UiBadge>
            </div>
            <div class="flex flex-wrap gap-3 text-xs text-muted">
              <span>created {{ formatBrowserDate(key.created_at) }}</span>
              <span v-if="key.last_used_at">last used {{ formatBrowserDate(key.last_used_at) }}</span>
            </div>
          </div>
          <UiButton
            v-if="!key.revoked_at"
            variant="ghost"
            size="sm"
            @click="revokeApiKey(key.id)"
          >
            <TrashIcon class="size-4" aria-hidden="true" />
            Revoke
          </UiButton>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No keys yet. Create one above to start posting captures from external tools.</p>
    </section>
  </main>
</template>
