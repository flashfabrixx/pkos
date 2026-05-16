import { createError, readBody } from 'h3'
import { z } from 'zod'
import type { CaptureInput, Confidentiality } from '@bkos/core'
import { requireAuthOrApiKey } from '../../../utils/auth'
import { withTransaction } from '../../../utils/db'
import { prepareInput } from '../../../utils/extractor'
import { processDocument } from '../../../utils/process'
import { safeFetchUrl } from '../../../utils/url-fetch'

const schema = z.object({
  url: z.string().url(),
  selection: z.string().max(50_000).optional(),
  title: z.string().max(300).optional(),
  capturedAt: z.string().min(1).optional(),
  confidentiality: z.enum(['private', 'internal', 'sensitive']).optional()
})

/**
 * Bookmarklet endpoint. Body carries the page URL plus any text the
 * user selected on the page. The server re-fetches the URL for canonical
 * title/description (selection from the browser is trusted text but we
 * never expand it server-side). SSRF-safe via utils/url-fetch.
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'captures:write')
  const body = schema.parse(await readBody(event))

  const fetched = await safeFetchUrl(body.url)
  const title = (body.title || fetched.title || fetched.finalUrl).slice(0, 300)
  // Compose a friendly text. Selection comes first because it's what the
  // user actually wanted to capture; description is supporting context.
  const parts = [
    body.selection?.trim(),
    fetched.description?.trim(),
    `Source: ${fetched.finalUrl}`
  ].filter(Boolean)
  const rawText = parts.join('\n\n') || `Captured page: ${fetched.finalUrl}`

  const draft: Omit<CaptureInput, 'title'> & { title?: string } = {
    title,
    sourceType: 'reflection',
    rawText,
    confidentiality: (body.confidentiality || 'private') as Confidentiality,
    capturedAt: body.capturedAt || new Date().toISOString().slice(0, 10)
  }
  const input = prepareInput(draft)

  return withTransaction(async (client) => {
    const docResult = await client.query<{ id: string }>(
      `INSERT INTO documents (title, source_type, raw_text, status, metadata, captured_at)
       VALUES ($1, $2, $3, 'new', $4, $5) RETURNING id`,
      [
        input.title,
        input.sourceType,
        input.rawText,
        {
          confidentiality: input.confidentiality,
          clip: { url: body.url, final_url: fetched.finalUrl, status: fetched.status }
        },
        input.capturedAt || null
      ]
    )
    const documentId = docResult.rows[0]!.id
    const job = await client.query<{ id: string }>(
      `INSERT INTO processing_jobs (document_id, status) VALUES ($1, 'queued') RETURNING id`,
      [documentId]
    )
    const extracted = await processDocument(client, documentId, input, job.rows[0]!.id)
    return { documentId, finalUrl: fetched.finalUrl, extracted }
  })
})
