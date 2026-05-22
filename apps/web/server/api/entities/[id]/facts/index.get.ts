import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { query } from '../../../../utils/db'
import type { FactRow } from '../../../../utils/entity-facts'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  // Make sure the entity exists and is one of the supported types.
  const entity = await query<{ type: string }>(
    `SELECT type FROM entities WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  if (!entity.rowCount) throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
  if (!['person', 'project', 'tag'].includes(entity.rows[0]!.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Facts are only supported for people, projects, and tags' })
  }

  const facts = await query<FactRow>(
    `SELECT id, entity_id, body, position,
            created_at::text AS created_at, updated_at::text AS updated_at
     FROM entity_facts
     WHERE entity_id = $1
     ORDER BY position ASC, created_at ASC`,
    [id]
  )
  return { facts: facts.rows }
})
