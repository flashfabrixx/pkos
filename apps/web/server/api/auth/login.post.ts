import { createError, getRequestIP, readBody } from 'h3'
import { z } from 'zod'
import { isTotpEnabled } from '../../utils/auth-config'
import { createSession, setSessionCookie } from '../../utils/auth'
import { hashPassword, isHashed, verifyPassword } from '../../utils/password'
import { createPreAuthToken } from '../../utils/pre-auth'
import { recordLoginFailure, recordLoginSuccess, throwIfLocked } from '../../utils/rate-limit'

const schema = z.object({
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(1024)
})

// Fixed-cost dummy hash, lazy-initialized to keep boot fast and avoid TLA.
let dummyHashPromise: Promise<string> | null = null
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('__bkos_no_credentials_configured__')
  }
  return dummyHashPromise
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  throwIfLocked(ip)

  const body = schema.parse(await readBody(event))

  const usernameMatches = body.username === config.username
  let passwordMatches = false

  const configuredHash = (config as { passwordHash?: string }).passwordHash || ''
  const configuredPlain = config.password as string

  if (configuredHash && isHashed(configuredHash)) {
    passwordMatches = await verifyPassword(body.password, configuredHash)
  } else if (configuredPlain) {
    if (!globalThis.__bkos_warned_plaintext_password) {
      console.warn(
        '[bkos][security] BKOS_PASSWORD is set as plaintext. ' +
        'Generate a hash via `pnpm setup:password` and use BKOS_PASSWORD_HASH instead.'
      )
      globalThis.__bkos_warned_plaintext_password = true
    }
    passwordMatches = constantTimeStringEqual(body.password, configuredPlain)
  } else {
    // No credentials configured: keep timing stable.
    await verifyPassword(body.password, await getDummyHash())
  }

  if (!usernameMatches || !passwordMatches) {
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  recordLoginSuccess(ip)

  // If 2FA is configured, first step is done — issue a pre-auth token and
  // ask the client to submit a TOTP code or a backup code via /api/auth/2fa/login.
  if (await isTotpEnabled()) {
    return {
      authenticated: false,
      requires_2fa: true,
      pre_auth_token: createPreAuthToken(body.username, config.sessionSecret)
    }
  }

  setSessionCookie(event, createSession(body.username, config.sessionSecret))
  return { authenticated: true, username: body.username }
})

function constantTimeStringEqual(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length)
  let result = a.length === b.length ? 0 : 1
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return result === 0
}

declare global {
  // eslint-disable-next-line no-var
  var __bkos_warned_plaintext_password: boolean | undefined
}
