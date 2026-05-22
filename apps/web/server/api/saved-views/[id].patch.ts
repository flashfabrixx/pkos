import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { filtersSchema, type SavedViewRow } from '../../utils/saved-views'

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  q: z.string().max(500).optional(),
  filters: filtersSchema.optional()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  const input = parsed.data
  if (input.name === undefined && input.q === undefined && input.filters === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const sets: string[] = ['updated_at = now()']
  const params: unknown[] = []
  let i = 1
  if (input.name !== undefined) {
    sets.push(`name = $${i++}`)
    params.push(input.name.trim())
  }
  if (input.q !== undefined) {
    sets.push(`q = $${i++}`)
    params.push(input.q)
  }
  if (input.filters !== undefined) {
    sets.push(`filters = $${i++}::jsonb`)
    params.push(JSON.stringify(input.filters))
  }
  params.push(id)

  const r = await query<SavedViewRow>(
    `UPDATE saved_views
        SET ${sets.join(', ')}
      WHERE id = $${i} AND deleted_at IS NULL
      RETURNING id, name, q, filters,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    params
  )
  if (!r.rowCount) throw createError({ statusCode: 404, statusMessage: 'Saved view not found' })
  return { view: r.rows[0] }
})
