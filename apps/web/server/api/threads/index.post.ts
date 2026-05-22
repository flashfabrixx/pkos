import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { DEFAULT_THREAD_MODEL, SUPPORTED_THREAD_MODELS } from '../../utils/threads'

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  model: z.enum(SUPPORTED_THREAD_MODELS).optional(),
  systemPrompt: z.string().trim().max(8000).nullable().optional()
})

/**
 * Create a new thread. All fields optional - a thread is born with
 * a generic title and the default model, and gets auto-renamed on
 * the first user turn.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = schema.parse((await readBody(event)) || {})

  const result = await query<{ id: string }>(
    `INSERT INTO conversation_threads (title, model, system_prompt)
     VALUES (COALESCE($1, 'New thread'), $2, $3)
     RETURNING id`,
    [body.title || null, body.model || DEFAULT_THREAD_MODEL, body.systemPrompt ?? null]
  )
  const id = result.rows[0]?.id
  if (!id) throw createError({ statusCode: 500, statusMessage: 'Failed to create thread' })

  return { id }
})
