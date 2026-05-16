import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },
  css: ['~/assets/css/app.css'],
  runtimeConfig: {
    username: process.env.BKOS_USERNAME || 'marcel',
    password: process.env.BKOS_PASSWORD || '',
    passwordHash: process.env.BKOS_PASSWORD_HASH || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    databaseUrl: process.env.DATABASE_URL || 'postgres://bkos:bkos@localhost:5433/bkos',
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
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'BKOS'
    }
  },
  typescript: {
    strict: true
  },
  nitro: {
    externals: {
      inline: ['@bkos/core', '@bkos/ingest', '@bkos/retrieval']
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
      '0 7 * * *': ['reminders:actions']
    }
  },
  vite: {
    plugins: [tailwindcss() as any],
    optimizeDeps: {
      include: ['@headlessui/vue', '@heroicons/vue/20/solid', '@heroicons/vue/24/outline', 'mammoth/mammoth.browser']
    }
  }
})
