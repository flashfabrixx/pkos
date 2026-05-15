import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const DELETABLE_TYPES = new Set(['person', 'project', 'tag'])

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const existing = await query<{ id: string, type: string }>(
    `SELECT id, type FROM entities WHERE id = $1`,
    [id]
  )
  const entity = existing.rows[0]
  if (!entity) throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
  if (!DELETABLE_TYPES.has(entity.type)) {
    throw createError({ statusCode: 403, statusMessage: `Entity type '${entity.type}' cannot be deleted via this endpoint` })
  }

  await query(`DELETE FROM entities WHERE id = $1`, [id])
  return { deleted: true, id, type: entity.type }
})
