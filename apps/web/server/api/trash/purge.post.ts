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

  // Hard delete only items that are already in trash. The FK cascades
  // on documents/entities take care of dependent rows.
  const result = await query(
    `DELETE FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: `${kind} not in trash` })
  return { purged: true, kind, id }
})
