import { createError, getRequestIP, readBody } from 'h3'
import { z } from 'zod'
import { createSession, setSessionCookie } from '../../../utils/auth'
import { isTotpEnabled, persistBackupCodes, readAuthConfig } from '../../../utils/auth-config'
import { tryConsume } from '../../../utils/backup-codes'
import { decryptSecret } from '../../../utils/crypto-vault'
import { verifyPreAuthToken } from '../../../utils/pre-auth'
import { recordLoginFailure, recordLoginSuccess, throwIfLocked } from '../../../utils/rate-limit'
import { verifyTotpCode } from '../../../utils/totp'

const schema = z.object({
  pre_auth_token: z.string().min(8),
  code: z.string().trim().min(6).max(20)
})

/**
 * Second step of login when 2FA is enabled. Consumes the pre-auth token from
 * the password step and verifies either a TOTP code or a backup code.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  throwIfLocked(ip)
  const body = schema.parse(await readBody(event))

  const session = verifyPreAuthToken(body.pre_auth_token, config.sessionSecret)
  if (!session) {
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, statusMessage: 'Pre-auth token invalid or expired. Sign in again.' })
  }

  if (!(await isTotpEnabled())) {
    throw createError({ statusCode: 400, statusMessage: 'Two-factor authentication is not configured.' })
  }

  const cfg = await readAuthConfig()
  let verified = false

  // Try TOTP first (6 digits, decoded), fall back to backup code.
  if (/^\d{6}$/.test(body.code) && cfg.totp_secret_encrypted) {
    const secret = decryptSecret(cfg.totp_secret_encrypted, config.sessionSecret)
    if (verifyTotpCode(secret, body.code)) verified = true
  }
  if (!verified) {
    const result = tryConsume(cfg.backup_codes, body.code)
    if (result.ok) {
      await persistBackupCodes(result.updated)
      verified = true
    }
  }

  if (!verified) {
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, statusMessage: 'Invalid code.' })
  }

  recordLoginSuccess(ip)
  setSessionCookie(event, createSession(session.username, config.sessionSecret))
  return { authenticated: true, username: session.username }
})
