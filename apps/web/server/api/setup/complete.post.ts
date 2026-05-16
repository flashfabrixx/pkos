import { readBody } from 'h3'
import { z } from 'zod'
import { markSetupComplete } from '../../utils/setup-state'

const schema = z.object({
  embedding_ok: z.boolean().optional(),
  mail_configured: z.boolean().optional()
}).default({})

/**
 * Final wizard step. Records non-secret notes and flips the gate so
 * future requests skip the redirect to /setup. We deliberately don't
 * gate on the password/secret being set here — those are enforced at
 * boot by `security-boot-check`, so the install would not even be
 * running unless they were already configured.
 */
export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event) || {})
  await markSetupComplete({
    embedding_ok: body.embedding_ok ?? null,
    mail_configured: body.mail_configured ?? null
  })
  return { completed: true }
})
