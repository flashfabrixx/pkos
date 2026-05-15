<script setup lang="ts">
definePageMeta({ layout: 'empty' })

const username = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function login() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    await navigateTo('/')
  } catch {
    error.value = 'Login failed.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="login-shell">
    <form class="login-panel" @submit.prevent="login">
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
  </main>
</template>
