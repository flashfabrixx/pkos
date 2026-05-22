import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { query, withTransaction } from '../../../../utils/db'
import type { FactRow } from '../../../../utils/entity-facts'

const schema = z.object({
  body: z.string().trim().min(1).max(800),
  /** Optional 0-based position; default = end of list. */
  position: z.number().int().min(0).optional()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const input = schema.parse(await readBody(event))

  const entity = await query<{ type: string }>(
    `SELECT type FROM entities WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  if (!entity.rowCount) throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
  if (!['person', 'project', 'tag'].includes(entity.rows[0]!.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Facts are only supported for people, projects, and tags' })
  }

  // Default position: max + 1 so new entries land at the end. When the
  // caller specified a position, shift everything at or beyond it
  // down by one within a transaction.
  return withTransaction(async (client) => {
    let position: number
    if (input.position !== undefined) {
      await client.query(
        `UPDATE entity_facts SET position = position + 1, updated_at = now()
         WHERE entity_id = $1 AND position >= $2`,
        [id, input.position]
      )
      position = input.position
    } else {
      const maxRes = await client.query<{ max: number | null }>(
        `SELECT MAX(position) AS max FROM entity_facts WHERE entity_id = $1`,
        [id]
      )
      position = (maxRes.rows[0]?.max ?? -1) + 1
    }

    const r = await client.query<FactRow>(
      `INSERT INTO entity_facts (entity_id, body, position)
       VALUES ($1, $2, $3)
       RETURNING id, entity_id, body, position,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [id, input.body, position]
    )
    return { fact: r.rows[0] }
  })
})
