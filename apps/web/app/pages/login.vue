<script setup lang="ts">
definePageMeta({ layout: 'empty' })

const step = ref<'password' | 'totp'>('password')
const username = ref('')
const password = ref('')
const code = ref('')
const preAuthToken = ref('')
const error = ref('')
const pending = ref(false)

async function submitPassword() {
  error.value = ''
  pending.value = true
  try {
    const result = await $fetch<{ authenticated: boolean, requires_2fa?: boolean, pre_auth_token?: string }>(
      '/api/auth/login',
      { method: 'POST', body: { username: username.value, password: password.value } }
    )
    if (result.requires_2fa && result.pre_auth_token) {
      preAuthToken.value = result.pre_auth_token
      step.value = 'totp'
      return
    }
    if (result.authenticated) {
      await navigateTo('/')
    }
  } catch (e: any) {
    if (e?.statusCode === 429) {
      error.value = 'Too many attempts. Try again in a few minutes.'
    } else {
      error.value = 'Login failed.'
    }
  } finally {
    pending.value = false
  }
}

async function submitTotp() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/2fa/login', {
      method: 'POST',
      body: { pre_auth_token: preAuthToken.value, code: code.value.trim() }
    })
    await navigateTo('/')
  } catch (e: any) {
    if (e?.statusCode === 429) {
      error.value = 'Too many attempts. Try again in a few minutes.'
    } else {
      error.value = e?.statusMessage || 'Invalid code.'
    }
  } finally {
    pending.value = false
  }
}

function backToPassword() {
  step.value = 'password'
  code.value = ''
  preAuthToken.value = ''
  error.value = ''
}
</script>

<template>
  <main class="login-shell">
    <form v-if="step === 'password'" class="login-panel" @submit.prevent="submitPassword">
      <div>
        <p class="eyebrow">BKOS</p>
        <h1>Sign in</h1>
      </div>
      <label>
        Username
        <input v-model="username" autocomplete="username" autofocus>
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password">
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="pending">
        {{ pending ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <form v-else class="login-panel" @submit.prevent="submitTotp">
      <div>
        <p class="eyebrow">BKOS · Step 2</p>
        <h1>Two-factor code</h1>
        <p class="muted">Enter the 6-digit code from your authenticator app — or a backup code if you lost the device.</p>
      </div>
      <label>
        Code
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          autofocus
          maxlength="20"
          placeholder="123 456"
        >
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="pending || !code.trim()">
        {{ pending ? 'Verifying...' : 'Verify' }}
      </button>
      <button type="button" class="login-link" @click="backToPassword">Use a different account</button>
    </form>
  </main>
</template>
