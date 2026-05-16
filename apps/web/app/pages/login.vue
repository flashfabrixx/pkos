<script setup lang="ts">
import { useI18n } from 'vue-i18n'

definePageMeta({ layout: 'empty' })

const { t } = useI18n()
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
        <h1>{{ t('login.title') }}</h1>
      </div>
      <label>
        {{ t('login.username') }}
        <input v-model="username" autocomplete="username" autofocus>
      </label>
      <label>
        {{ t('login.password') }}
        <input v-model="password" type="password" autocomplete="current-password">
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="pending">
        {{ pending ? t('login.submitting') : t('login.submit') }}
      </button>
    </form>

    <form v-else class="login-panel" @submit.prevent="submitTotp">
      <div>
        <p class="eyebrow">BKOS · Step 2</p>
        <h1>{{ t('login.twofa_code') }}</h1>
      </div>
      <label>
        {{ t('login.twofa_code') }}
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
        {{ pending ? t('login.submitting') : t('login.twofa_submit') }}
      </button>
      <button type="button" class="login-link" @click="backToPassword">{{ t('common.close') }}</button>
    </form>
  </main>
</template>
