import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

const schema = z.object({
  kind: z.enum(['documents', 'entities', 'actions', 'comments']),
  id: z.string().uuid()
})

const TABLE_BY_KIND = {
  documents: 'documents',
  entities: 'entities',
  actions: 'action_items',
  comments: 'comments'
} as const

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const { kind, id } = schema.parse(await readBody(event))
  const table = TABLE_BY_KIND[kind]

  const result = await query(
    `UPDATE ${table} SET deleted_at = NULL, updated_at = now()
     WHERE id = $1 AND deleted_at IS NOT NULL
     RETURNING id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: `${kind} not in trash` })
  return { restored: true, kind, id }
})
