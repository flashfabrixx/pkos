import { createError } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { isTotpEnabled } from '../../../utils/auth-config'
import { buildOtpauthUri, generateBase32Secret } from '../../../utils/totp'

/**
 * Step 1 of enrollment: generate a fresh TOTP secret and return it together
 * with an otpauth:// URI for the authenticator app. The secret is NOT yet
 * persisted — the client must call /enroll/verify with a valid code first.
 */
export default defineEventHandler(async (event) => {
  const username = requireAuth(event)
  if (await isTotpEnabled()) {
    throw createError({ statusCode: 409, statusMessage: 'Two-factor authentication is already enabled. Disable it first to re-enroll.' })
  }

  const secret = generateBase32Secret()
  const uri = buildOtpauthUri({
    secret,
    issuer: 'PKOS',
    account: username
  })
  return { secret, otpauth_uri: uri }
})
