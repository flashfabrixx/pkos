import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import type { MessageRow, ThreadRow } from '../../utils/threads'

/**
 * Read one thread with all its messages in insertion order. The
 * detail page hydrates from this single call; subsequent turns are
 * appended via /api/threads/:id/messages without a full reload.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const threadResult = await query<ThreadRow>(
    `SELECT id, title, model, system_prompt, metadata,
            created_at::text AS created_at,
            updated_at::text AS updated_at,
            archived_at::text AS archived_at
     FROM conversation_threads
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  const thread = threadResult.rows[0]
  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Thread not found' })

  const messagesResult = await query<MessageRow>(
    `SELECT id, thread_id, role, content, sources, model, provider,
            tokens_in, tokens_out, created_at::text AS created_at
     FROM conversation_messages
     WHERE thread_id = $1
     ORDER BY created_at ASC, id ASC`,
    [id]
  )

  return { thread, messages: messagesResult.rows }
})
