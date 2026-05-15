import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const documentResult = await query(
    `SELECT d.id, d.title, d.source_type, d.raw_text, d.summary, d.status, d.metadata, d.archive_path,
            d.captured_at::text AS captured_at, d.created_at, d.updated_at, d.language,
            e.id AS entity_id
     FROM documents d
     LEFT JOIN entities e
       ON e.type = 'document' AND (e.metadata->>'document_id')::uuid = d.id
     WHERE d.id = $1`,
    [id]
  )
  const document = documentResult.rows[0]
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Document not found' })

  const [people, projects, actions, decisions, insights, questions, tags, jobs, comments] = await Promise.all([
    query(
      `SELECT DISTINCT e.id, e.name
       FROM entities e
       JOIN entity_mentions em ON em.entity_id = e.id
       WHERE em.document_id = $1 AND e.type = 'person'
       ORDER BY e.name`,
      [id]
    ),
    query(
      `SELECT DISTINCT e.id, e.name
       FROM entities e
       JOIN entity_mentions em ON em.entity_id = e.id
       WHERE em.document_id = $1 AND e.type = 'project'
       ORDER BY e.name`,
      [id]
    ),
    query(
      `SELECT a.id, a.title, a.status, a.due_date, a.created_at, a.person_id, pe.name AS person_name,
              ae.id AS entity_id
       FROM action_items a
       LEFT JOIN entities pe ON pe.id = a.person_id
       LEFT JOIN entities ae
         ON ae.type = 'topic'
         AND ae.metadata->>'kind' = 'action_item'
         AND ae.name = a.title
       WHERE a.document_id = $1
       ORDER BY a.created_at`,
      [id]
    ),
    query(
      `SELECT d.id, d.title, d.rationale, d.created_at, e.id AS entity_id
       FROM decisions d
       LEFT JOIN entities e ON e.type = 'decision' AND e.name = d.title
       WHERE d.document_id = $1
       ORDER BY d.created_at`,
      [id]
    ),
    query(
      `SELECT i.id, i.title, i.created_at, e.id AS entity_id
       FROM insights i
       LEFT JOIN entities e ON e.type = 'insight' AND e.name = i.title
       WHERE i.document_id = $1
       ORDER BY i.created_at`,
      [id]
    ),
    query(
      `SELECT q.id, q.title, q.status, q.created_at, e.id AS entity_id
       FROM open_questions q
       LEFT JOIN entities e ON e.type = 'question' AND e.name = q.title
       WHERE q.document_id = $1
       ORDER BY q.created_at`,
      [id]
    ),
    query(
      `SELECT DISTINCT e.id, e.name
       FROM entities e
       JOIN entity_mentions em ON em.entity_id = e.id
       WHERE em.document_id = $1 AND e.type = 'tag'
       ORDER BY e.name`,
      [id]
    ),
    query('SELECT id, status, error, started_at, finished_at, created_at FROM processing_jobs WHERE document_id = $1 ORDER BY created_at DESC', [id]),
    query(
      `SELECT c.id, c.entity_id, c.body, c.document_id, c.created_at, c.updated_at
       FROM comments c
       WHERE c.entity_id IN (
         SELECT entity_id FROM entity_mentions WHERE document_id = $1
         UNION
         SELECT id FROM entities WHERE type = 'document' AND (metadata->>'document_id')::uuid = $1
       )
       ORDER BY c.created_at ASC`,
      [id]
    )
  ])

  return {
    document,
    people: people.rows,
    projects: projects.rows,
    actions: actions.rows,
    decisions: decisions.rows,
    insights: insights.rows,
    openQuestions: questions.rows,
    tags: tags.rows,
    jobs: jobs.rows,
    comments: comments.rows
  }
})
