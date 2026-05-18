import { query } from '../utils/db'
import { setMinIatSecondsFromDb } from '../utils/auth'
import { logger } from '../utils/logger'

// Bootstrap-time security checks. Throws on startup if the runtime config
// is configured in a way that would be unsafe to deploy.
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const sessionSecret = config.sessionSecret as string
  const passwordHash = (config as { passwordHash?: string }).passwordHash || ''
  const password = config.password as string
  const isProd = process.env.NODE_ENV === 'production'

  const errors: string[] = []
  const warnings: string[] = []

  if (!sessionSecret) {
    errors.push(
      'SESSION_SECRET is required. Generate one with `openssl rand -base64 48` and put it in .env.'
    )
  } else if (sessionSecret.length < 32) {
    errors.push(
      `SESSION_SECRET is too short (${sessionSecret.length} chars). Use at least 32 characters.`
    )
  } else if (sessionSecret === 'dev-secret-change-me' || sessionSecret === 'replace-with-a-long-random-secret') {
    errors.push('SESSION_SECRET is set to a known placeholder. Generate a real secret.')
  }

  if (!passwordHash && !password) {
    errors.push(
      'No credentials configured. Run `pnpm pkos:hash-password` to generate PKOS_PASSWORD_HASH for your .env.'
    )
  } else if (!passwordHash && password) {
    warnings.push(
      'PKOS_PASSWORD is set as plaintext. Generate a hash with `pnpm pkos:hash-password` and use PKOS_PASSWORD_HASH instead.'
    )
    if (password === 'change-me') {
      errors.push('PKOS_PASSWORD is still the placeholder value. Pick a real password.')
    }
  }

  if (isProd && !sessionSecret) {
    // Already caught above, but be loud about it in prod.
  }

  for (const warning of warnings) {
    logger.warn({ component: 'security' }, warning)
  }

  if (errors.length) {
    const message = ['Refusing to start due to unsafe configuration:', ...errors.map((e) => `  - ${e}`)].join('\n')
    logger.error({ component: 'security', errors }, message)
    throw new Error(message)
  }

  // Warm the session-revocation checkpoint from DB so we can reject tokens
  // issued before the most recent logout / password rotation.
  try {
    const result = await query<{ session_min_iat: string }>(
      `SELECT EXTRACT(EPOCH FROM session_min_iat)::bigint::text AS session_min_iat FROM auth_config WHERE id = 1`
    )
    setMinIatSecondsFromDb(Number(result.rows[0]?.session_min_iat || 0))
  } catch (error) {
    logger.warn({ component: 'security', err: (error as Error).message }, 'Could not load session revocation checkpoint (DB not ready yet?). Defaulting to 0.')
  }
})
