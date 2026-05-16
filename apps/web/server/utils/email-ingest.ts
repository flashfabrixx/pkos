import type { CaptureInput, Confidentiality, SourceType } from '@bkos/core'
import { withTransaction } from './db'
import { prepareInput } from './extractor'
import { logger } from './logger'
import { processDocument } from './process'
import { getFileStore } from './storage'

/**
 * Structured shape we feed to the ingest pipeline. Independent of the
 * IMAP / SMTP wire format so unit tests can construct one directly.
 */
export interface IncomingEmail {
  messageId: string
  fromAddress: string
  subject: string
  body: string
  receivedAt?: Date
  attachments?: Array<{
    filename: string
    contentType: string
    content: Buffer
  }>
}

export interface IngestResult {
  status: 'ingested' | 'duplicate' | 'rejected'
  documentId?: string
  reason?: string
}

/**
 * Apply an envelope-level filter, deduplicate via message-id, then create
 * a capture (plus attachments) inside one transaction.
 */
export async function ingestEmail(message: IncomingEmail, allowList: string[]): Promise<IngestResult> {
  const sender = message.fromAddress.toLowerCase().trim()
  if (allowList.length && !allowList.includes(sender)) {
    logger.info({ component: 'email', sender }, 'email rejected: sender not in allow-list')
    return { status: 'rejected', reason: 'sender not in allow-list' }
  }

  return withTransaction(async (client) => {
    // ON CONFLICT short-circuits if we've already ingested this message.
    const dedupe = await client.query<{ inserted: boolean }>(
      `INSERT INTO email_ingest_log (message_id, sender)
       VALUES ($1, $2)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING true AS inserted`,
      [message.messageId, sender]
    )
    if (!dedupe.rowCount) {
      return { status: 'duplicate' }
    }

    const draft: Omit<CaptureInput, 'title'> & { title?: string } = {
      title: message.subject || `Email from ${sender}`,
      sourceType: 'conversation' as SourceType,
      rawText: (message.body || '').trim() || `(empty body) from ${sender}`,
      confidentiality: 'internal' as Confidentiality,
      capturedAt: (message.receivedAt || new Date()).toISOString().slice(0, 10),
      participants: sender
    }
    const input = prepareInput(draft)

    const docResult = await client.query<{ id: string }>(
      `INSERT INTO documents (title, source_type, raw_text, status, metadata, captured_at)
       VALUES ($1, $2, $3, 'new', $4, $5) RETURNING id`,
      [
        input.title,
        input.sourceType,
        input.rawText,
        {
          confidentiality: input.confidentiality,
          email: { sender, message_id: message.messageId }
        },
        input.capturedAt || null
      ]
    )
    const documentId = docResult.rows[0]!.id

    for (const attachment of message.attachments || []) {
      const stored = await getFileStore().put(attachment.filename, attachment.content)
      await client.query(
        `INSERT INTO document_attachments (document_id, filename, mime_type, size_bytes, storage_path, checksum_sha256)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, attachment.filename, attachment.contentType, stored.sizeBytes, stored.storagePath, stored.checksumSha256]
      )
    }

    await client.query(`UPDATE email_ingest_log SET document_id = $1 WHERE message_id = $2`, [documentId, message.messageId])

    const job = await client.query<{ id: string }>(
      `INSERT INTO processing_jobs (document_id, status) VALUES ($1, 'queued') RETURNING id`,
      [documentId]
    )
    await processDocument(client, documentId, input, job.rows[0]!.id)
    logger.info({ component: 'email', sender, document_id: documentId }, 'email ingested')
    return { status: 'ingested', documentId }
  })
}

export function parseAllowList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}
