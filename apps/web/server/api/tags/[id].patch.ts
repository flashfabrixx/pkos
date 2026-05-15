import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { canonicalize } from '../../utils/canonicalize'

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional()
}).refine((value) => value.name !== undefined || value.description !== undefined, {
  message: 'At least one field must be provided'
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const updates: string[] = []
  const values: Array<string | null> = []

  if (body.name !== undefined) {
    values.push(body.name)
    updates.push(`name = $${values.length}`)
    values.push(canonicalize(body.name))
    updates.push(`canonical_name = $${values.length}`)
  }

  if (body.description !== undefined) {
    values.push(JSON.stringify({ description: body.description || null }))
    updates.push(`metadata = metadata || $${values.length}::jsonb`)
  }

  values.push(id)

  try {
    const result = await query(
      `UPDATE entities
       SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${values.length} AND type = 'tag'
       RETURNING id, name, canonical_name, metadata`,
      values
    )
    if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
    return { tag: result.rows[0] }
  } catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Another tag already uses this name' })
    }
    throw error
  }
})
