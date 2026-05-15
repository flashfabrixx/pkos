import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  body: z.string().trim().min(1).max(10000)
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const data = schema.parse(await readBody(event))

  const result = await query(
    `UPDATE comments
     SET body = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, entity_id, body, document_id, created_at, updated_at`,
    [data.body, id]
  )

  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Comment not found' })
  return { comment: result.rows[0] }
})
