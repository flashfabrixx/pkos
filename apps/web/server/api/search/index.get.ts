import { getQuery } from 'h3'
import { makeExcerpt } from '@bkos/retrieval'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  if (!q) return { results: [], entities: [] }

  const entityHits = await query<{ id: string, type: string, name: string }>(
    `SELECT id, type, name
     FROM entities
     WHERE type IN ('person', 'project', 'tag')
       AND (name ILIKE $1 OR canonical_name ILIKE $1)
     ORDER BY
       CASE
         WHEN lower(name) = lower($2) THEN 0
         WHEN name ILIKE ($2 || '%') THEN 1
         ELSE 2
       END,
       length(name) ASC,
       name ASC
     LIMIT 8`,
    [`%${q}%`, q]
  )

  const result = await query<{
    document_id: string
    title: string
    source_type: string
    summary: string | null
    captured_at: string | null
    created_at: string
    content: string
    rank: number | null
  }>(
    // The query is parsed under every common config and OR-ed together so a
    // term like "Workshops" matches German-stemmed "workshop" or English
    // "workshop" the same way. The doc was indexed in its own language; the
    // query side covers the rest.
    `WITH q AS (
       SELECT
         websearch_to_tsquery('simple', $1) AS q_simple,
         websearch_to_tsquery('english', $1) AS q_en,
         websearch_to_tsquery('german', $1) AS q_de
     ), ranked AS (
       SELECT
         d.id AS document_id,
         d.title,
         d.source_type,
         d.summary,
         d.captured_at::text AS captured_at,
         d.created_at,
         c.content,
         GREATEST(
           ts_rank(c.search_vector, (SELECT q_simple FROM q)),
           ts_rank(c.search_vector, (SELECT q_en FROM q)),
           ts_rank(c.search_vector, (SELECT q_de FROM q))
         ) AS rank
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.search_vector @@ (SELECT q_simple FROM q)
          OR c.search_vector @@ (SELECT q_en FROM q)
          OR c.search_vector @@ (SELECT q_de FROM q)
          OR c.content ILIKE '%' || $1 || '%'
          OR d.title ILIKE '%' || $1 || '%'
     )
     SELECT DISTINCT ON (document_id)
       document_id, title, source_type, summary, captured_at, created_at, content, rank
     FROM ranked
     ORDER BY document_id, rank DESC, created_at DESC
     LIMIT 20`,
    [q]
  )

  return {
    results: result.rows
      .map((row) => ({
        ...row,
        excerpt: makeExcerpt([row.title, row.summary, row.content].filter(Boolean).join('\n\n'), q)
      }))
      .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0)),
    entities: entityHits.rows
  }
})
