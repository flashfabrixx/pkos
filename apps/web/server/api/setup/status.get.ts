import { isSetupComplete } from '../../utils/setup-state'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig() as { sessionSecret?: string, passwordHash?: string, embeddingProvider?: string }
  return {
    completed: await isSetupComplete(),
    checks: {
      session_secret: Boolean(config.sessionSecret && config.sessionSecret.length >= 32),
      password_hash: Boolean(config.passwordHash),
      embedding_provider: ((config.embeddingProvider || 'placeholder').toLowerCase() !== 'placeholder')
    }
  }
})
