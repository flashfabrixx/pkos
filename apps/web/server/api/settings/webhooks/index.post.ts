import { randomBytes } from 'node:crypto'
import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'
import { query } from '../../../utils/db'
import { ALL_EVENT_TYPES } from '../../../utils/events'

const schema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(ALL_EVENT_TYPES as unknown as [string, ...string[]])).optional()
})

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const body = schema.parse(await readBody(event))
  // 32-byte HMAC secret; the client must store this to verify signatures.
  const secret = randomBytes(32).toString('base64url')
  const result = await query<{ id: string }>(
    `INSERT INTO webhook_subscriptions (url, secret, events, created_by)
     VALUES ($1, $2, $3::text[], $4) RETURNING id`,
    [body.url, secret, body.events || [], actor]
  )
  const id = result.rows[0]!.id
  await recordAudit({ event, actor, action: 'webhook.subscribe', resourceKind: 'webhook', resourceId: id, meta: { url: body.url } })
  return { id, url: body.url, events: body.events || [], secret }
})
