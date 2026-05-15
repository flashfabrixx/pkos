import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { withTransaction } from '../../utils/db'
import { upsertEntity } from '../../utils/graph'

const schema = z.object({
  type: z.enum(['person', 'project', 'tag']),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional()
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = schema.parse(await readBody(event))

  try {
    const entity = await withTransaction(async (client) => {
      const ref = await upsertEntity(client, body.type, body.name)
      if (body.description) {
        await client.query(
          `UPDATE entities
           SET metadata = metadata || $1::jsonb, updated_at = now()
           WHERE id = $2`,
          [JSON.stringify({ description: body.description }), ref.id]
        )
      }
      return ref
    })
    return { entity: { id: entity.id, type: entity.type, name: entity.name } }
  } catch (error: any) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'An entity with this name already exists' })
    }
    throw error
  }
})
