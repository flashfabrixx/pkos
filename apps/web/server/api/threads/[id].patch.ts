import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { SUPPORTED_THREAD_MODELS } from '../../utils/threads'

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  model: z.enum(SUPPORTED_THREAD_MODELS).optional(),
  systemPrompt: z.string().trim().max(8000).nullable().optional(),
  archived: z.boolean().optional()
}).refine(
  (v) => v.title !== undefined || v.model !== undefined || v.systemPrompt !== undefined || v.archived !== undefined,
  { message: 'At least one field must be provided' }
)

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const updates: string[] = []
  const values: Array<string | null> = []

  if (body.title !== undefined) {
    values.push(body.title)
    updates.push(`title = $${values.length}`)
  }
  if (body.model !== undefined) {
    values.push(body.model)
    updates.push(`model = $${values.length}`)
  }
  if (body.systemPrompt !== undefined) {
    values.push(body.systemPrompt)
    updates.push(`system_prompt = $${values.length}`)
  }
  if (body.archived !== undefined) {
    // archived: true sets archived_at to now(); false clears it.
    updates.push(`archived_at = ${body.archived ? 'now()' : 'NULL'}`)
  }

  values.push(id)

  const result = await query<{ id: string }>(
    `UPDATE conversation_threads
       SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING id`,
    values
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  return { id: result.rows[0]!.id }
})
