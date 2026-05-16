import { createError, readMultipartFormData } from 'h3'
import type { CaptureInput, Confidentiality, SourceType } from '@bkos/core'
import { requireAuthOrApiKey } from '../../../utils/auth'
import { withTransaction } from '../../../utils/db'
import { prepareInput } from '../../../utils/extractor'
import { processDocument } from '../../../utils/process'
import { extractText } from '../../../utils/file-extract'
import { getFileStore } from '../../../utils/storage'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/json',
  'application/xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif'
])

/**
 * Multipart upload entry point. Accepts a single `file` field plus
 * optional metadata fields. Writes the file via the storage abstraction
 * and creates a fresh capture using the extracted text. Returns the new
 * documentId so the caller can navigate to it.
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'captures:write')
  const config = useRuntimeConfig() as unknown as { maxUploadMb?: string | number }
  const maxBytes = Math.max(1, Number(config.maxUploadMb || 25)) * 1024 * 1024

  const parts = await readMultipartFormData(event)
  if (!parts || !parts.length) throw createError({ statusCode: 400, statusMessage: 'No multipart body' })

  const filePart = parts.find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.filename) throw createError({ statusCode: 400, statusMessage: 'Missing file field' })
  if (filePart.data.byteLength > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` })
  }
  const mimeType = (filePart.type || 'application/octet-stream').toLowerCase()
  if (!ALLOWED_MIME.has(mimeType)) {
    throw createError({ statusCode: 415, statusMessage: `Unsupported file type: ${mimeType}` })
  }

  const fieldByName = (name: string): string | undefined => {
    const part = parts.find((p) => p.name === name && !p.filename)
    return part ? part.data.toString('utf8') : undefined
  }
  const sourceType = (fieldByName('sourceType') || 'other') as SourceType
  const confidentiality = (fieldByName('confidentiality') || 'private') as Confidentiality
  const titleOverride = fieldByName('title')
  const capturedAt = fieldByName('capturedAt') || new Date().toISOString().slice(0, 10)

  const buffer = Buffer.isBuffer(filePart.data) ? filePart.data : Buffer.from(filePart.data)
  const text = await extractText(buffer, mimeType, filePart.filename)
  // Even an empty extraction is useful to record: the file still lives,
  // and the user can attach context manually later.
  const rawText = text && text.trim().length >= 10 ? text : `Uploaded file: ${filePart.filename}`

  const stored = await getFileStore().put(filePart.filename, buffer)

  const draft = {
    title: titleOverride || filePart.filename,
    sourceType,
    rawText,
    capturedAt,
    confidentiality
  }
  const input: CaptureInput = prepareInput(draft)

  return withTransaction(async (client) => {
    const docResult = await client.query<{ id: string }>(
      `INSERT INTO documents (title, source_type, raw_text, status, metadata, captured_at)
       VALUES ($1, $2, $3, 'new', $4, $5) RETURNING id`,
      [
        input.title,
        input.sourceType,
        input.rawText,
        { confidentiality: input.confidentiality, has_attachment: true },
        input.capturedAt || null
      ]
    )
    const documentId = docResult.rows[0]!.id

    await client.query(
      `INSERT INTO document_attachments (document_id, filename, mime_type, size_bytes, storage_path, checksum_sha256)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [documentId, filePart.filename, mimeType, stored.sizeBytes, stored.storagePath, stored.checksumSha256]
    )

    const jobResult = await client.query<{ id: string }>(
      `INSERT INTO processing_jobs (document_id, status) VALUES ($1, 'queued') RETURNING id`,
      [documentId]
    )
    const extracted = await processDocument(client, documentId, input, jobResult.rows[0]!.id)
    return {
      documentId,
      filename: filePart.filename,
      mimeType,
      sizeBytes: stored.sizeBytes,
      extracted
    }
  })
})
