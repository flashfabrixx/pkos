import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  title: z.string().trim().min(1).max(500)
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const result = await query(
    `UPDATE insights
     SET title = $1
     WHERE id = $2
     RETURNING id, title, document_id, created_at`,
    [body.title, id]
  )

  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Insight not found' })
  return { insight: result.rows[0] }
})
