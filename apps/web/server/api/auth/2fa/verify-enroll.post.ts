import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { isTotpEnabled, persistTotp } from '../../../utils/auth-config'
import { generateBackupCodes } from '../../../utils/backup-codes'
import { encryptSecret } from '../../../utils/crypto-vault'
import { verifyTotpCode } from '../../../utils/totp'

const schema = z.object({
  secret: z.string().min(16).max(256),
  code: z.string().regex(/^\d{6}$/)
})

/**
 * Step 2 of enrollment: client posts the secret it received plus a TOTP code
 * generated from it. If valid, we encrypt the secret with SESSION_SECRET,
 * persist it, generate backup codes and return them (shown ONCE).
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const config = useRuntimeConfig()
  if (await isTotpEnabled()) {
    throw createError({ statusCode: 409, statusMessage: 'Two-factor authentication is already enabled.' })
  }
  const body = schema.parse(await readBody(event))
  if (!verifyTotpCode(body.secret, body.code)) {
    throw createError({ statusCode: 400, statusMessage: 'Code does not match. Check your authenticator and try again.' })
  }

  const { plain, stored } = generateBackupCodes()
  const encrypted = encryptSecret(body.secret, config.sessionSecret)
  await persistTotp(encrypted, stored)

  return {
    enabled: true,
    backup_codes: plain
  }
})
