import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { isSupportedLanguageCode, pgConfigFor } from '../../utils/detect-language'

const schema = z.object({
  language: z.union([z.string().trim().min(2).max(8), z.null()]).optional()
}).refine((value) => value.language !== undefined, {
  message: 'No supported fields supplied'
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const next = body.language ? body.language.toLowerCase() : null
  if (next && !isSupportedLanguageCode(next)) {
    throw createError({ statusCode: 400, statusMessage: `Language "${next}" is not supported.` })
  }
  const pgConfig = pgConfigFor(next)

  // Persist on the document and update its tsvector index in one go.
  const docResult = await query<{ id: string }>(
    `UPDATE documents
     SET language = $1,
         metadata = metadata || jsonb_build_object('language_pg_config', $2::text),
         updated_at = now()
     WHERE id = $3
     RETURNING id`,
    [next, pgConfig, id]
  )
  if (!docResult.rowCount) throw createError({ statusCode: 404, statusMessage: 'Document not found' })

  await query(
    `UPDATE chunks SET search_vector = to_tsvector($1::regconfig, content) WHERE document_id = $2`,
    [pgConfig, id]
  )

  return { id, language: next, language_pg_config: pgConfig }
})
