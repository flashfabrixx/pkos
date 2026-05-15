import { createError, getQuery } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  entity_id: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = schema.safeParse(getQuery(event))
  if (!params.success) throw createError({ statusCode: 400, statusMessage: params.error.message })

  const result = await query(
    `SELECT id, entity_id, body, document_id, created_at, updated_at
     FROM comments
     WHERE entity_id = $1
     ORDER BY created_at ASC`,
    [params.data.entity_id]
  )
  return { comments: result.rows }
})
