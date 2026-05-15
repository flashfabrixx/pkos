import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { clearTotp, isTotpEnabled } from '../../../utils/auth-config'
import { isHashed, verifyPassword } from '../../../utils/password'

const schema = z.object({
  password: z.string().min(1).max(1024)
})

/**
 * Disabling 2FA requires re-typing the current password to avoid drive-by
 * attacks via stolen sessions.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const config = useRuntimeConfig()
  if (!(await isTotpEnabled())) {
    return { enabled: false }
  }
  const body = schema.parse(await readBody(event))

  const configuredHash = (config as { passwordHash?: string }).passwordHash || ''
  const configuredPlain = config.password as string

  let ok = false
  if (configuredHash && isHashed(configuredHash)) {
    ok = await verifyPassword(body.password, configuredHash)
  } else if (configuredPlain) {
    ok = body.password === configuredPlain
  }

  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'Password is incorrect.' })
  }

  await clearTotp()
  return { enabled: false }
})
