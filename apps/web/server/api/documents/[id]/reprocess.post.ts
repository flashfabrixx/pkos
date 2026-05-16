import { createError, getRouterParam } from 'h3'
import type { CaptureInput, Confidentiality, SourceType } from '@bkos/core'
import { requireAuth } from '../../utils/auth'
import { withTransaction } from '../../utils/db'
import { prepareInput } from '../../utils/extractor'
import { processDocument } from '../../utils/process'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  return withTransaction(async (client) => {
    const documentResult = await client.query<{
      id: string
      title: string
      source_type: SourceType
      raw_text: string
      captured_at: string | null
      metadata: { participants?: string, project?: string, confidentiality?: Confidentiality }
    }>(
      `SELECT id, title, source_type, raw_text, captured_at::text AS captured_at, metadata
       FROM documents
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    const document = documentResult.rows[0]
    if (!document) throw createError({ statusCode: 404, statusMessage: 'Document not found' })

    const draft = {
      title: document.title,
      sourceType: document.source_type,
      rawText: document.raw_text,
      participants: document.metadata?.participants || '',
      project: document.metadata?.project || '',
      capturedAt: document.captured_at || '',
      confidentiality: (document.metadata?.confidentiality || 'private') as Confidentiality
    }
    const input: CaptureInput = prepareInput(draft)

    // Wipe prior extraction so the new run is authoritative. Hard-deleting
    // here is correct: these rows belong to the document and are about to
    // be re-derived.
    await client.query('DELETE FROM chunks WHERE document_id = $1', [id])
    await client.query('DELETE FROM entity_mentions WHERE document_id = $1', [id])
    await client.query('DELETE FROM knowledge_edges WHERE document_id = $1', [id])
    await client.query('DELETE FROM action_items WHERE document_id = $1', [id])
    await client.query('DELETE FROM decisions WHERE document_id = $1', [id])
    await client.query('DELETE FROM insights WHERE document_id = $1', [id])
    await client.query('DELETE FROM open_questions WHERE document_id = $1', [id])

    const jobResult = await client.query<{ id: string }>(
      'INSERT INTO processing_jobs (document_id, status) VALUES ($1, $2) RETURNING id',
      [id, 'queued']
    )
    const jobRow = jobResult.rows[0]
    if (!jobRow) throw createError({ statusCode: 500, statusMessage: 'Job insert failed' })

    const extracted = await processDocument(client, id, input, jobRow.id)
    return { documentId: id, jobId: jobRow.id, status: 'processed', extracted }
  })
})
