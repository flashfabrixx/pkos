import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { filtersSchema, type SavedViewRow } from '../../utils/saved-views'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  q: z.string().max(500).optional(),
  filters: filtersSchema.optional()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  const input = parsed.data

  const r = await query<SavedViewRow>(
    `INSERT INTO saved_views (name, q, filters)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, name, q, filters,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [input.name.trim(), input.q || '', JSON.stringify(input.filters || {})]
  )
  return { view: r.rows[0] }
})
