import type pg from 'pg'
import type { CaptureInput, EntityType, ExtractedKnowledge } from '@bkos/core'
import { writeArchive } from './archive'
import { extractCapture } from './extractor'
import { upsertEntity, writeKnowledgeGraph } from './graph'

export async function processDocument(client: pg.PoolClient, documentId: string, input: CaptureInput, jobId: string) {
  await client.query(
    'UPDATE processing_jobs SET status = $1, started_at = now(), updated_at = now() WHERE id = $2',
    ['processing', jobId]
  )
  await client.query('UPDATE documents SET status = $1, updated_at = now() WHERE id = $2', ['processing', documentId])

  try {
    const extraction = await extractCapture(input)
    const preparedInput = extraction.input
    const extracted = extraction.extracted
    const people = await ensureEntities(client, 'person', extracted.people)
    const projects = await ensureEntities(client, 'project', extracted.projects)
    await writeExtractedRows(client, documentId, extracted, people[0]?.id, projects[0]?.id)
    await writeChunks(client, documentId, preparedInput, extracted)
    await writeKnowledgeGraph(client, documentId, preparedInput.title, extracted)
    const archivePath = await writeArchive(documentId, preparedInput, extracted)

    await client.query(
      `UPDATE documents
       SET title = $1,
           summary = $2,
           status = $3,
           archive_path = $4,
           metadata = metadata || $5::jsonb,
           updated_at = now()
       WHERE id = $6`,
      [
        preparedInput.title,
        extracted.summary,
        'processed',
        archivePath,
        JSON.stringify({
          participants: extracted.people.join(', ') || preparedInput.participants || '',
          project: extracted.projects[0] || preparedInput.project || '',
          extractor_provider: extraction.provider
        }),
        documentId
      ]
    )
    await client.query(
      'UPDATE processing_jobs SET status = $1, finished_at = now(), updated_at = now() WHERE id = $2',
      ['done', jobId]
    )

    return extracted
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client.query('UPDATE documents SET status = $1, updated_at = now() WHERE id = $2', ['failed', documentId])
    await client.query(
      'UPDATE processing_jobs SET status = $1, error = $2, finished_at = now(), updated_at = now() WHERE id = $3',
      ['failed', message, jobId]
    )
    throw error
  }
}

async function ensureEntities(client: pg.PoolClient, type: EntityType, names: string[]) {
  const linked: Array<{ id: string, name: string }> = []
  for (const name of names) {
    const entity = await upsertEntity(client, type, name)
    linked.push({ id: entity.id, name: entity.name })
  }
  return linked
}

async function writeExtractedRows(
  client: pg.PoolClient,
  documentId: string,
  extracted: ExtractedKnowledge,
  firstPersonId?: string,
  firstProjectId?: string
) {
  for (const title of extracted.actionItems) {
    await client.query(
      'INSERT INTO action_items (document_id, person_id, project_id, title) VALUES ($1, $2, $3, $4)',
      [documentId, firstPersonId || null, firstProjectId || null, title]
    )
  }
  for (const title of extracted.decisions) {
    await client.query('INSERT INTO decisions (document_id, title) VALUES ($1, $2)', [documentId, title])
  }
  for (const title of extracted.insights) {
    await client.query('INSERT INTO insights (document_id, title) VALUES ($1, $2)', [documentId, title])
  }
  for (const title of extracted.openQuestions) {
    await client.query('INSERT INTO open_questions (document_id, title) VALUES ($1, $2)', [documentId, title])
  }
  // Tags now live exclusively in `entities` (type='tag') — created by writeKnowledgeGraph.
}

async function writeChunks(client: pg.PoolClient, documentId: string, input: CaptureInput, extracted: ExtractedKnowledge) {
  const chunks = [
    { type: 'summary', content: extracted.summary },
    { type: 'section', content: [input.title, extracted.summary, ...extracted.insights].join('\n\n') },
    ...splitParagraphs(input.rawText).map((content) => ({ type: 'paragraph', content }))
  ]

  for (const [position, chunk] of chunks.entries()) {
    await client.query(
      'INSERT INTO chunks (document_id, chunk_type, content, position) VALUES ($1, $2, $3, $4)',
      [documentId, chunk.type, chunk.content, position]
    )
  }
}

function splitParagraphs(text: string) {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  if (paragraphs.length) return paragraphs.slice(0, 20)
  return text.match(/.{1,900}(\s|$)/g)?.map((part) => part.trim()).filter(Boolean).slice(0, 20) || []
}
