import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { readActivities } from '../../utils/entity-activity'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const entityResult = await query(
    `SELECT id, type, name, canonical_name, metadata, created_at, updated_at,
            summary, summary_state, summary_updated_at
     FROM entities
     WHERE id = $1 AND type = 'tag'`,
    [id]
  )
  const tag = entityResult.rows[0]
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Tag not found' })

  const [documents, related, comments, stats] = await Promise.all([
    query(
      `SELECT d.id, d.title, d.source_type, d.captured_at::text AS captured_at, d.created_at, d.summary
       FROM documents d
       WHERE d.id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
       ORDER BY COALESCE(d.captured_at, d.created_at::date) DESC, d.created_at DESC`,
      [id]
    ),
    query(
      `SELECT e.id, e.type, e.name, COUNT(DISTINCT em.document_id)::int AS co_mentions
       FROM entity_mentions em
       JOIN entities e ON e.id = em.entity_id
       WHERE em.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
         AND e.id <> $1
         AND e.type IN ('person', 'project', 'tag')
       GROUP BY e.id, e.type, e.name
       ORDER BY co_mentions DESC, e.name ASC
       LIMIT 30`,
      [id]
    ),
    query(
      `SELECT id, entity_id, body, document_id, created_at, updated_at
       FROM comments
       WHERE entity_id = $1
       ORDER BY created_at ASC`,
      [id]
    ),
    query(
      `SELECT
         (SELECT COUNT(DISTINCT document_id)::int FROM entity_mentions WHERE entity_id = $1) AS document_count,
         (SELECT MIN(d.captured_at)::text FROM documents d JOIN entity_mentions em ON em.document_id = d.id WHERE em.entity_id = $1) AS first_seen,
         (SELECT MAX(d.captured_at)::text FROM documents d JOIN entity_mentions em ON em.document_id = d.id WHERE em.entity_id = $1) AS last_seen`,
      [id]
    )
  ])

  const grouped = { people: [] as any[], projects: [] as any[], tags: [] as any[] }
  for (const row of related.rows) {
    if (row.type === 'person') grouped.people.push(row)
    else if (row.type === 'project') grouped.projects.push(row)
    else if (row.type === 'tag') grouped.tags.push(row)
  }

  const activities = await readActivities(id)

  return {
    tag,
    stats: stats.rows[0] || {},
    documents: documents.rows,
    related: grouped,
    comments: comments.rows,
    activities
  }
})
