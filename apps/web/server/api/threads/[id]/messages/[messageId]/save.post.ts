import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../../utils/auth'
import { query } from '../../../../../utils/db'

interface SavedSource { documentId: string }

/**
 * Persist an assistant message as a first-class PKOS Document so the
 * synthesis is searchable, can be cited from other threads, and
 * survives the original thread being archived. The new document
 * carries `metadata.derived_from = {kind, thread_id, message_id,
 * source_documents}` so the document detail can render a "Derived
 * from thread X" trail.
 *
 * Cookie auth.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const threadId = getRouterParam(event, 'id')
  const messageId = getRouterParam(event, 'messageId')
  if (!threadId || !messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const message = await query<{
    role: string, content: string, sources: SavedSource[] | null, created_at: string,
    thread_title: string
  }>(
    `SELECT m.role, m.content, m.sources, m.created_at::text AS created_at,
            t.title AS thread_title
     FROM conversation_messages m
     JOIN conversation_threads t ON t.id = m.thread_id
     WHERE m.id = $1 AND m.thread_id = $2 AND t.deleted_at IS NULL`,
    [messageId, threadId]
  )
  const row = message.rows[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Message not found' })
  if (row.role !== 'assistant') {
    throw createError({ statusCode: 400, statusMessage: 'Only assistant messages can be saved as documents' })
  }
  if (!row.content || !row.content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Message has no content to save' })
  }

  const sourceDocumentIds = Array.isArray(row.sources)
    ? row.sources.map((s) => s.documentId).filter((id): id is string => typeof id === 'string')
    : []

  const metadata = {
    confidentiality: 'private',
    derived_from: {
      kind: 'thread_message',
      thread_id: threadId,
      message_id: messageId,
      source_documents: sourceDocumentIds
    }
  }

  // Pick a title from the source thread + an indicator that it's a
  // saved synthesis, so the captures list reads clearly.
  const title = (`Saved: ${row.thread_title || 'Thread'}`).slice(0, 180)

  const inserted = await query<{ id: string }>(
    `INSERT INTO documents
       (title, source_type, raw_text, status, metadata, captured_at, summary)
     VALUES ($1, 'reflection', $2, 'processed', $3::jsonb, CURRENT_DATE, $4)
     RETURNING id`,
    [title, row.content, JSON.stringify(metadata), row.content.split('\n')[0]?.slice(0, 280) || null]
  )
  const documentId = inserted.rows[0]!.id

  // Link the source documents into the new one via entity_mentions
  // skipped on purpose - the derived_from metadata is the source of
  // truth here, and source documents already live as their own
  // captures. We do create a knowledge_edges row per source so the
  // graph view picks up the derivation.
  if (sourceDocumentIds.length) {
    // Each source document has its own document-entity (created by
    // the extractor pipeline). For derived-from edges we want a
    // document->document relation; that requires both sides to have
    // their own 'document' entity. The new document doesn't have one
    // yet because we skipped the full extraction pipeline. Leave the
    // edge wiring to a future pass - derived_from metadata is
    // sufficient for the UI.
  }

  return { documentId }
})
