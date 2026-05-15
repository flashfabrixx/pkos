import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  rationale: z.string().trim().max(2000).nullable().optional()
}).refine((value) => value.title !== undefined || value.rationale !== undefined, {
  message: 'At least one field must be provided'
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const updates: string[] = []
  const values: Array<string | null> = []

  if (body.title !== undefined) {
    values.push(body.title)
    updates.push(`title = $${values.length}`)
  }
  if (body.rationale !== undefined) {
    values.push(body.rationale || null)
    updates.push(`rationale = $${values.length}`)
  }

  values.push(id)

  const result = await query(
    `UPDATE decisions
     SET ${updates.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, title, rationale, document_id, created_at`,
    values
  )

  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Decision not found' })
  return { decision: result.rows[0] }
})
