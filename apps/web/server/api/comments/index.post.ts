import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  entityId: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
  documentId: z.string().uuid().nullable().optional()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const data = schema.parse(await readBody(event))

  const result = await query(
    `INSERT INTO comments (entity_id, body, document_id)
     VALUES ($1, $2, $3)
     RETURNING id, entity_id, body, document_id, created_at, updated_at`,
    [data.entityId, data.body, data.documentId || null]
  )
  const comment = result.rows[0]
  if (!comment) throw createError({ statusCode: 500, statusMessage: 'Comment insert failed' })
  return { comment }
})
