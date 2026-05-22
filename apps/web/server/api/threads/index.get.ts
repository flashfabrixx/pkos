import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import type { ThreadRow } from '../../utils/threads'

/**
 * List threads, newest activity first. `?archived=1` to include
 * archived ones (default: only active). `?limit=` 1-100, default 50.
 *
 * Cookie auth only - chat threads are internal-only UI state.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100)
  const includeArchived = params.archived === '1' || params.archived === 'true'

  const filters: string[] = ['deleted_at IS NULL']
  if (!includeArchived) filters.push('archived_at IS NULL')

  const result = await query<ThreadRow & { last_message_at: string | null, message_count: number }>(
    `SELECT t.id, t.title, t.model, t.system_prompt, t.metadata,
            t.created_at::text AS created_at,
            t.updated_at::text AS updated_at,
            t.archived_at::text AS archived_at,
            (SELECT MAX(created_at)::text FROM conversation_messages WHERE thread_id = t.id) AS last_message_at,
            (SELECT COUNT(*)::int FROM conversation_messages WHERE thread_id = t.id) AS message_count
     FROM conversation_threads t
     WHERE ${filters.join(' AND ')}
     ORDER BY t.updated_at DESC
     LIMIT $1`,
    [limit]
  )

  return { threads: result.rows }
})
