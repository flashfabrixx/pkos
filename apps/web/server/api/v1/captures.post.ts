import { createError, readBody } from 'h3'
import { z } from 'zod'
import { sourceTypes, confidentialityLevels, type CaptureInput } from '@bkos/core'
import { requireAuthOrApiKey } from '../../utils/auth'
import { withTransaction } from '../../utils/db'
import { prepareInput } from '../../utils/extractor'
import { processDocument } from '../../utils/process'

const schema = z.object({
  title: z.string().max(180).optional().default(''),
  sourceType: z.enum(sourceTypes),
  rawText: z.string().min(10),
  participants: z.string().optional().default(''),
  project: z.string().optional().default(''),
  capturedAt: z.string().min(1),
  confidentiality: z.enum(confidentialityLevels)
})

/**
 * Versioned public capture endpoint. Same body shape as the internal UI
 * endpoint, but authenticated via session cookie *or* API key (Bearer).
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'captures:write')
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  }

  const draft = {
    ...parsed.data,
    title: parsed.data.title || undefined,
    participants: parsed.data.participants || undefined,
    project: parsed.data.project || undefined
  }
  const input: CaptureInput = prepareInput(draft)

  return withTransaction(async (client) => {
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO documents (title, source_type, raw_text, status, metadata, captured_at)
       VALUES ($1, $2, $3, 'new', $4, $5) RETURNING id`,
      [
        input.title,
        input.sourceType,
        input.rawText,
        {
          participants: input.participants || '',
          project: input.project || '',
          confidentiality: input.confidentiality
        },
        input.capturedAt || null
      ]
    )
    const documentId = documentResult.rows[0]!.id
    const jobResult = await client.query<{ id: string }>(
      `INSERT INTO processing_jobs (document_id, status) VALUES ($1, 'queued') RETURNING id`,
      [documentId]
    )
    const extracted = await processDocument(client, documentId, input, jobResult.rows[0]!.id)
    return { documentId, status: 'processed', extracted }
  })
})
