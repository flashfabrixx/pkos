import { createError, readBody } from 'h3'
import { z } from 'zod'
import { sourceTypes, confidentialityLevels, type CaptureInput } from '@pkos/core'
import { requireAuth } from '../../utils/auth'
import { withTransaction } from '../../utils/db'
import { emitEvent } from '../../utils/events'
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

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  }

  const draft = {
    ...parsed.data,
    title: parsed.data.title || undefined,
    capturedAt: parsed.data.capturedAt,
    participants: parsed.data.participants || undefined,
    project: parsed.data.project || undefined
  }
  const input: CaptureInput = prepareInput(draft)

  return withTransaction(async (client) => {
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO documents (title, source_type, raw_text, status, metadata, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.title,
        input.sourceType,
        input.rawText,
        'new',
        {
          participants: input.participants || '',
          project: input.project || '',
          confidentiality: input.confidentiality
        },
        input.capturedAt || null
      ]
    )
    const documentRow = documentResult.rows[0]
    if (!documentRow) throw createError({ statusCode: 500, statusMessage: 'Document insert failed' })
    const documentId = documentRow.id
    const jobResult = await client.query<{ id: string }>(
      'INSERT INTO processing_jobs (document_id, status) VALUES ($1, $2) RETURNING id',
      [documentId, 'queued']
    )
    const jobRow = jobResult.rows[0]
    if (!jobRow) throw createError({ statusCode: 500, statusMessage: 'Job insert failed' })
    const extracted = await processDocument(client, documentId, input, jobRow.id)

    await emitEvent('capture.created', { document_id: documentId, title: input.title, source_type: input.sourceType })
    await emitEvent('capture.processed', { document_id: documentId, summary: extracted.summary?.slice(0, 240) })

    return {
      documentId,
      jobId: jobRow.id,
      status: 'processed',
      extracted
    }
  })
})
