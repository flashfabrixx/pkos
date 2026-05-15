<script setup lang="ts">
import { ShieldCheckIcon, ShieldExclamationIcon } from '@heroicons/vue/24/outline'

interface Status {
  enabled: boolean
  enabled_at: string | null
  backup_codes_remaining: number
  backup_codes_total: number
}

const { data, refresh } = await useFetch<Status>('/api/auth/2fa/status')

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
            <p class="eyebrow">Settings</p>
            <h1>Security</h1>
          </div>
        </div>

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
      </section>
    </main>
  </div>
</template>
