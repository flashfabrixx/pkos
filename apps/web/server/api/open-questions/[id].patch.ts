import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { openQuestionStatuses } from '@pkos/core'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  status: z.enum(openQuestionStatuses)
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const result = await query(
    `UPDATE open_questions
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, title, status, document_id, created_at`,
    [body.status, id]
  )

  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Open question not found' })
  return { question: result.rows[0] }
})
