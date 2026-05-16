<script setup lang="ts">
import { useI18n } from 'vue-i18n'

definePageMeta({ layout: 'empty' })

const { t } = useI18n()
useHead({ title: () => t('login.title') })
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
  <main class="grid min-h-screen place-items-center bg-app p-6">
    <form
      v-if="step === 'password'"
      class="grid w-full max-w-[360px] gap-4 rounded-card border border-panel-border bg-surface-1 p-6 shadow-card"
      @submit.prevent="submitPassword"
    >
      <div class="space-y-1">
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">BKOS</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('login.title') }}</h1>
      </div>
      <UiField :label="t('login.username')">
        <template #default="{ id }">
          <UiInput :id="id" v-model="username" autocomplete="username" autofocus />
        </template>
      </UiField>
      <UiField :label="t('login.password')">
        <template #default="{ id }">
          <UiInput :id="id" v-model="password" type="password" autocomplete="current-password" />
        </template>
      </UiField>
      <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" :loading="pending" block>
        {{ pending ? t('login.submitting') : t('login.submit') }}
      </UiButton>
    </form>

    <form
      v-else
      class="grid w-full max-w-[360px] gap-4 rounded-card border border-panel-border bg-surface-1 p-6 shadow-card"
      @submit.prevent="submitTotp"
    >
      <div class="space-y-1">
        <p class="text-[11px] font-extrabold uppercase tracking-wider text-muted">BKOS · Step 2</p>
        <h1 class="text-xl font-semibold tracking-tight text-text-strong">{{ t('login.twofa_code') }}</h1>
      </div>
      <UiField :label="t('login.twofa_code')">
        <template #default="{ id }">
          <UiInput
            :id="id"
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            maxlength="20"
            placeholder="123 456"
          />
        </template>
      </UiField>
      <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" :disabled="!code.trim()" :loading="pending" block>
        {{ pending ? t('login.submitting') : t('login.twofa_submit') }}
      </UiButton>
      <button
        type="button"
        class="rounded-md p-1.5 text-center text-xs font-semibold text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        @click="backToPassword"
      >{{ t('common.close') }}</button>
    </form>
  </main>
</template>
