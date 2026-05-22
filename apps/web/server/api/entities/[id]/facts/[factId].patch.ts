import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { query, withTransaction } from '../../../../utils/db'
import type { FactRow } from '../../../../utils/entity-facts'

const schema = z.object({
  body: z.string().trim().min(1).max(800).optional(),
  position: z.number().int().min(0).optional()
}).refine((v) => v.body !== undefined || v.position !== undefined, {
  message: 'At least one of body or position must be provided'
})

/**
 * Edit the body or move a fact within the list. A position change
 * renumbers all facts of the same entity in one pass to keep the
 * ordering stable and gap-free.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const entityId = getRouterParam(event, 'id')
  const factId = getRouterParam(event, 'factId')
  if (!entityId || !factId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const input = schema.parse(await readBody(event))

  return withTransaction(async (client) => {
    const existing = await client.query<{ position: number }>(
      `SELECT position FROM entity_facts WHERE id = $1 AND entity_id = $2`,
      [factId, entityId]
    )
    if (!existing.rowCount) throw createError({ statusCode: 404, statusMessage: 'Fact not found' })

    if (input.position !== undefined && input.position !== existing.rows[0]!.position) {
      // Resort: pull the current row, remove from list, insert at target.
      const all = await client.query<{ id: string, position: number }>(
        `SELECT id, position FROM entity_facts WHERE entity_id = $1 ORDER BY position ASC, created_at ASC`,
        [entityId]
      )
      const ordered = all.rows.filter((r) => r.id !== factId)
      const target = Math.min(input.position, ordered.length)
      ordered.splice(target, 0, { id: factId, position: target })
      for (let i = 0; i < ordered.length; i++) {
        await client.query(
          `UPDATE entity_facts SET position = $1, updated_at = now() WHERE id = $2`,
          [i, ordered[i]!.id]
        )
      }
    }

    if (input.body !== undefined) {
      await client.query(
        `UPDATE entity_facts SET body = $1, updated_at = now() WHERE id = $2 AND entity_id = $3`,
        [input.body, factId, entityId]
      )
    }

    const r = await client.query<FactRow>(
      `SELECT id, entity_id, body, position,
              created_at::text AS created_at, updated_at::text AS updated_at
       FROM entity_facts WHERE id = $1`,
      [factId]
    )
    return { fact: r.rows[0] }
  })
})
