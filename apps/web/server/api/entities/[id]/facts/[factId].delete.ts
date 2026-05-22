import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { withTransaction } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const entityId = getRouterParam(event, 'id')
  const factId = getRouterParam(event, 'factId')
  if (!entityId || !factId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  return withTransaction(async (client) => {
    const r = await client.query<{ position: number }>(
      `DELETE FROM entity_facts WHERE id = $1 AND entity_id = $2 RETURNING position`,
      [factId, entityId]
    )
    if (!r.rowCount) throw createError({ statusCode: 404, statusMessage: 'Fact not found' })

    // Close the hole so positions stay contiguous (helps the UI keep
    // ordering numbers stable).
    await client.query(
      `UPDATE entity_facts SET position = position - 1, updated_at = now()
       WHERE entity_id = $1 AND position > $2`,
      [entityId, r.rows[0]!.position]
    )

    return { deleted: true }
  })
})
