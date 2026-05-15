import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },
  css: ['~/assets/css/app.css'],
  runtimeConfig: {
    username: process.env.BKOS_USERNAME || 'marcel',
    password: process.env.BKOS_PASSWORD || 'change-me',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    databaseUrl: process.env.DATABASE_URL || 'postgres://bkos:bkos@localhost:5433/bkos',
    vaultPath: process.env.BKOS_VAULT_PATH || '../../vault',
    extractorProvider: process.env.BKOS_EXTRACTOR_PROVIDER || 'placeholder',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'gemma4:e4b',
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
    }
  },
  vite: {
    plugins: [tailwindcss() as any],
    optimizeDeps: {
      include: ['@headlessui/vue', '@heroicons/vue/20/solid', '@heroicons/vue/24/outline', 'mammoth/mammoth.browser']
    }
  }
})
