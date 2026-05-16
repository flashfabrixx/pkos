import { createError, getRouterParam } from 'h3'
import { requireAuthOrApiKey } from '../../../utils/auth'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'captures:read')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `SELECT id, title, source_type, summary, status, raw_text, language,
            captured_at::text AS captured_at, created_at, updated_at, metadata
       FROM documents
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  const document = result.rows[0]
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  return { document }
})
