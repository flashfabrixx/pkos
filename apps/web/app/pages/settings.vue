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
  <div>
    <main class="workspace single">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">{{ t('settings.eyebrow') }}</p>
            <h1>{{ t('settings.title') }}</h1>
          </div>
        </div>

        <section class="settings-section">
          <header class="settings-section-head">
            <PaintBrushIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>Appearance</h2>
              <p class="muted">Light, dark, or follow the operating system.</p>
            </div>
          </header>
          <div class="settings-segmented">
            <button
              v-for="opt in THEME_OPTIONS"
              :key="opt.value"
              type="button"
              class="settings-segment"
              :class="{ 'is-active': themeChoice === opt.value }"
              @click="applyTheme(opt.value)"
            >
              <component :is="opt.icon" class="size-4" aria-hidden="true" />
              <span>{{ t(`common.${opt.value}`) }}</span>
            </button>
          </div>
        </section>

        <section class="settings-section">
          <header class="settings-section-head">
            <LanguageIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>Language</h2>
              <p class="muted">Display language for the BKOS interface.</p>
            </div>
          </header>
          <div class="settings-segmented">
            <button
              v-for="code in localeOptions"
              :key="code"
              type="button"
              class="settings-segment"
              :class="{ 'is-active': locale === code }"
              @click="setLocale(code)"
            >
              <span class="settings-segment-code">{{ code.toUpperCase() }}</span>
              <span>{{ LOCALE_LABELS[code] || code }}</span>
            </button>
          </div>
        </section>

        <section class="settings-section">
          <header class="settings-section-head">
            <component :is="data?.enabled ? ShieldCheckIcon : ShieldExclamationIcon" class="size-5" :class="data?.enabled ? 'text-emerald-600' : 'text-amber-600'" aria-hidden="true" />
            <div>
              <h2>Two-factor authentication</h2>
              <p class="muted">{{ data?.enabled ? 'Enabled — your account asks for a 6-digit code at login.' : 'Disabled — only a password protects your account.' }}</p>
            </div>
          </header>

          <div v-if="data?.enabled" class="settings-2fa-enabled">
            <p>Backup codes left: <strong>{{ data.backup_codes_remaining }} / {{ data.backup_codes_total }}</strong></p>
            <form @submit.prevent="disable">
              <label>
                Current password (required to disable 2FA)
                <input v-model="disablePassword" type="password" autocomplete="current-password">
              </label>
              <p v-if="error" class="error">{{ error }}</p>
              <button type="submit" class="settings-danger" :disabled="!disablePassword || pending">
                {{ pending ? 'Disabling…' : 'Disable two-factor' }}
              </button>
            </form>
          </div>

          <div v-else-if="phase === 'idle'">
            <p>Protect your BKOS account with an authenticator app (1Password, Authy, Google Authenticator, etc.).</p>
            <button type="button" class="settings-primary" :disabled="pending" @click="startEnroll">
              {{ pending ? 'Working…' : 'Enable two-factor' }}
            </button>
            <p v-if="error" class="error">{{ error }}</p>
          </div>

          <div v-else-if="phase === 'verifying'" class="settings-enroll">
            <ol class="settings-enroll-steps">
              <li>Open your authenticator app and add a new entry.</li>
              <li>
                Scan the QR by pasting this URI, or enter the secret manually:
                <code class="settings-otp-uri">{{ enrollUri }}</code>
                <p class="muted">Secret: <code>{{ enrollSecret }}</code></p>
              </li>
              <li>
                Enter the current 6-digit code from your authenticator below.
              </li>
            </ol>
            <form @submit.prevent="verifyEnroll">
              <label>
                6-digit code
                <input
                  v-model="enrollCode"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  placeholder="123 456"
                  autofocus
                >
              </label>
              <p v-if="error" class="error">{{ error }}</p>
              <div class="settings-enroll-actions">
                <button type="button" class="settings-secondary" @click="cancelEnroll">Cancel</button>
                <button type="submit" class="settings-primary" :disabled="enrollCode.length !== 6 || pending">
                  {{ pending ? 'Verifying…' : 'Confirm and enable' }}
                </button>
              </div>
            </form>
          </div>

          <div v-else-if="phase === 'showing-backup-codes'" class="settings-backup-codes">
            <h3>Save your backup codes</h3>
            <p class="muted">Each code works once. Use one if you lose access to your authenticator. Store them somewhere safe — they will not be shown again.</p>
            <pre class="settings-backup-list">{{ backupCodes.join('\n') }}</pre>
            <div class="settings-enroll-actions">
              <button type="button" class="settings-secondary" @click="copyBackupCodes">Copy to clipboard</button>
              <button type="button" class="settings-primary" @click="finishBackupCodes">I've saved them</button>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <header class="settings-section-head">
            <KeyIcon class="size-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2>API keys</h2>
              <p class="muted">Programmatic access for the BKOS REST API at <code>/api/v1/*</code>. Use as <code>Authorization: Bearer &lt;key&gt;</code>.</p>
            </div>
          </header>

          <div v-if="newlyCreated" class="settings-backup-codes">
            <h3>New key created — copy it now</h3>
            <p class="muted">This is the only time the full key is shown. Store it in your secrets manager.</p>
            <pre class="settings-backup-list">{{ newlyCreated.plaintext }}</pre>
            <div class="settings-enroll-actions">
              <button type="button" class="settings-secondary" @click="copyToClipboard(newlyCreated!.plaintext)">Copy</button>
              <button type="button" class="settings-primary" @click="dismissCreated">Done</button>
            </div>
          </div>

          <form class="settings-api-key-create" @submit.prevent="createApiKey">
            <label>
              Key name
              <input v-model="newKeyName" type="text" maxlength="120" placeholder="e.g. Shortcuts iPhone">
            </label>
            <button type="submit" class="settings-primary" :disabled="!newKeyName.trim() || creating">
              <PlusIcon class="size-4" aria-hidden="true" />
              {{ creating ? 'Creating…' : 'Create key' }}
            </button>
            <p v-if="keysError" class="error">{{ keysError }}</p>
          </form>

          <ul v-if="apiKeys.length" class="settings-api-key-list">
            <li v-for="key in apiKeys" :key="key.id" class="settings-api-key-row" :class="{ 'is-revoked': key.revoked_at }">
              <div class="settings-api-key-main">
                <strong>{{ key.name }}</strong>
                <code>bkos_{{ key.prefix }}_…</code>
                <span class="muted">{{ key.scopes.join(' · ') }}</span>
                <span v-if="key.revoked_at" class="settings-api-key-revoked">revoked</span>
              </div>
              <div class="settings-api-key-meta">
                <span class="muted">created {{ formatBrowserDate(key.created_at) }}</span>
                <span v-if="key.last_used_at" class="muted">last used {{ formatBrowserDate(key.last_used_at) }}</span>
              </div>
              <button
                v-if="!key.revoked_at"
                type="button"
                class="settings-api-key-revoke"
                @click="revokeApiKey(key.id)"
              >
                <TrashIcon class="size-4" aria-hidden="true" />
                <span>Revoke</span>
              </button>
            </li>
          </ul>
          <p v-else class="muted">No keys yet. Create one above to start posting captures from external tools.</p>
        </section>
      </section>
    </main>
  </div>
</template>
