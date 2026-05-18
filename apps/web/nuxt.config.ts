import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import tailwindcss from '@tailwindcss/vite'

// Nuxt's CLI `--dotenv` flag is unreliable across versions for runtimeConfig
// defaults that read process.env at config-load time. Load the repo-root
// .env eagerly here. We deliberately do NOT run dotenv-expand: values like
// BKOS_PASSWORD_HASH (scrypt format `scrypt$16384$8$1$…`) contain literal
// `$1`/`$8` segments that the expander would mistake for shell variables.
// Trade-off: write DATABASE_URL with the password inlined, not via
// `${POSTGRES_PASSWORD}` substitution.
const here = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(here, '../../.env'), override: false })

export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },
  css: ['~/assets/css/app.css'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover'
      // titleTemplate lives in the layouts so we can use a function
      // (nuxt.config's app.head only accepts strings here).
    }
  },
  runtimeConfig: {
    username: process.env.BKOS_USERNAME || 'marcel',
    password: process.env.BKOS_PASSWORD || '',
    passwordHash: process.env.BKOS_PASSWORD_HASH || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    databaseUrl: process.env.DATABASE_URL || 'postgres://pkos:pkos@localhost:5433/pkos',
    vaultPath: process.env.BKOS_VAULT_PATH || '../../vault',
    filesPath: process.env.BKOS_FILES_PATH || '../../files',
    maxUploadMb: process.env.BKOS_MAX_UPLOAD_MB || '25',
    mailHost: process.env.MAIL_HOST || '',
    mailPort: process.env.MAIL_PORT || '993',
    mailUser: process.env.MAIL_USER || '',
    mailPassword: process.env.MAIL_PASSWORD || '',
    mailSecure: process.env.MAIL_SECURE || 'true',
    mailFromAllow: process.env.MAIL_FROM_ALLOW || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    smtpSecure: process.env.SMTP_SECURE || 'false',
    smtpFrom: process.env.SMTP_FROM || '',
    reminderEmail: process.env.BKOS_REMINDER_EMAIL || '',
    extractorProvider: process.env.BKOS_EXTRACTOR_PROVIDER || 'placeholder',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'gemma4:e4b',
    embeddingProvider: process.env.BKOS_EMBEDDING_PROVIDER || 'placeholder',
    embeddingModel: process.env.BKOS_EMBEDDING_MODEL || '',
    openAIApiKey: process.env.OPENAI_API_KEY || '',
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'PKOS'
    }
  },
  typescript: {
    strict: true
  },
  nitro: {
    externals: {
      inline: ['@pkos/core', '@pkos/ingest', '@pkos/retrieval']
    },
    experimental: { tasks: true },
    scheduledTasks: {
      // Poll the IMAP inbox every 5 minutes when MAIL_HOST is set.
      // The task is a no-op when unset, so this is safe to always wire.
      '*/5 * * * *': ['email:poll'],
      // Recompute entity-link suggestions nightly. Cheap when there are
      // no embeddings; dismissed pairs honour a 30-day cooldown.
      '0 2 * * *': ['suggestions:entities'],
      // Action-reminder digest. No-op when SMTP_HOST or BKOS_REMINDER_EMAIL
      // is unset, so it's safe to always wire.
      '0 7 * * *': ['reminders:actions'],
      // Drain pending webhook deliveries every minute; rows with
      // next_attempt_at in the future are skipped.
      '*/1 * * * *': ['webhook:retry']
    }
  },
  vite: {
    plugins: [tailwindcss() as any],
    optimizeDeps: {
      include: ['@headlessui/vue', '@heroicons/vue/20/solid', '@heroicons/vue/24/outline', 'mammoth/mammoth.browser', 'vue-i18n']
    }
  }
})
