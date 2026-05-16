import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { ALL_SCOPES, DEFAULT_SCOPES, generateKey } from '../../../utils/api-keys'
import { query } from '../../../utils/db'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(ALL_SCOPES as unknown as [string, ...string[]])).optional()
})

/**
 * Create a new API key. The plaintext value is returned exactly once in
 * the response; the database only stores prefix + scrypt-hashed secret.
 */
export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const body = schema.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, statusMessage: body.error.message })

  const scopes = body.data.scopes && body.data.scopes.length > 0 ? body.data.scopes : [...DEFAULT_SCOPES]
  const { plaintext, prefix, hashedKey } = await generateKey()
  const result = await query<{ id: string }>(
    `INSERT INTO api_keys (name, prefix, hashed_key, scopes, actor)
     VALUES ($1, $2, $3, $4::text[], $5) RETURNING id`,
    [body.data.name, prefix, hashedKey, scopes, actor]
  )
  return {
    id: result.rows[0]!.id,
    name: body.data.name,
    prefix,
    scopes,
    plaintext,
    actor
  }
})
