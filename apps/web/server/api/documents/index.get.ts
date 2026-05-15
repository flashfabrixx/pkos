import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const result = await query(`
    SELECT id, title, source_type, summary, status, archive_path, captured_at::text AS captured_at, created_at, metadata
    FROM documents
    ORDER BY created_at DESC
    LIMIT 50
  `)
  return { documents: result.rows }
})
