import { getQuery } from 'h3'
import { makeExcerpt } from '@bkos/retrieval'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import { embedTexts, vectorToPg } from '../../utils/embedding'

const SEMANTIC_WEIGHT = 0.6
const LEXICAL_WEIGHT = 0.4

/**
 * Hybrid search. When an embedding provider is configured, the query is
 * embedded once and the chunks are scored as
 *
 *     SEMANTIC_WEIGHT * (1 - cosine_distance) + LEXICAL_WEIGHT * ts_rank
 *
 * Otherwise we fall back to lexical-only. Filters narrow the candidate
 * set before scoring: `kinds` (comma-separated source_type), `lang`
 * (ISO 639-1), `from` / `to` (yyyy-mm-dd captured_at range).
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  if (!q) return { results: [], entities: [], mode: 'idle' as const }

  const kinds = parseList(params.kinds)
  const lang = typeof params.lang === 'string' && params.lang.trim() ? params.lang.trim() : null
  const dateFrom = typeof params.from === 'string' && params.from.trim() ? params.from.trim() : null
  const dateTo = typeof params.to === 'string' && params.to.trim() ? params.to.trim() : null

  const entityHits = await query<{ id: string, type: string, name: string }>(
    `SELECT id, type, name
     FROM entities
     WHERE type IN ('person', 'project', 'tag')
       AND deleted_at IS NULL
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

  // Embed the query once; failures from the provider are non-fatal so
  // search degrades to lexical instead of hard-erroring.
  const embedding = await embedTexts([q]).catch(() => [{ vector: null }])
  const vector = embedding[0]?.vector ?? null
  const mode = vector ? 'hybrid' : 'lexical'

  const filters: string[] = ['d.deleted_at IS NULL']
  const values: Array<string | number | string[]> = [q]
  if (kinds.length) {
    values.push(kinds)
    filters.push(`d.source_type = ANY($${values.length}::text[])`)
  }
  if (lang) {
    values.push(lang)
    filters.push(`d.language = $${values.length}`)
  }
  if (dateFrom) {
    values.push(dateFrom)
    filters.push(`d.captured_at >= $${values.length}::date`)
  }
  if (dateTo) {
    values.push(dateTo)
    filters.push(`d.captured_at <= $${values.length}::date`)
  }

  let vectorParamIndex: number | null = null
  if (vector) {
    values.push(vectorToPg(vector) as unknown as string)
    vectorParamIndex = values.length
  }

  const cosineScore = vectorParamIndex
    ? `(1 - (c.embedding <=> $${vectorParamIndex}::vector))`
    : `0`

  const result = await query<{
    document_id: string
    title: string
    source_type: string
    summary: string | null
    captured_at: string | null
    created_at: string
    content: string
    score: number | null
    lexical_rank: number | null
    semantic_score: number | null
  }>(
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
         ) AS lexical_rank,
         ${cosineScore} AS semantic_score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE ${filters.join(' AND ')}
         AND (
           c.search_vector @@ (SELECT q_simple FROM q)
            OR c.search_vector @@ (SELECT q_en FROM q)
            OR c.search_vector @@ (SELECT q_de FROM q)
            OR c.content ILIKE '%' || $1 || '%'
            OR d.title ILIKE '%' || $1 || '%'
            ${vectorParamIndex ? `OR c.embedding IS NOT NULL` : ''}
         )
     ), scored AS (
       SELECT
         document_id, title, source_type, summary, captured_at, created_at, content,
         lexical_rank,
         semantic_score,
         (${vectorParamIndex ? SEMANTIC_WEIGHT : 0}) * semantic_score
           + ${LEXICAL_WEIGHT} * lexical_rank AS score
       FROM ranked
     )
     SELECT DISTINCT ON (document_id)
       document_id, title, source_type, summary, captured_at, created_at, content,
       score, lexical_rank, semantic_score
     FROM scored
     ORDER BY document_id, score DESC, created_at DESC
     LIMIT 30`,
    values
  )

  return {
    mode,
    results: result.rows
      .map((row) => ({
        ...row,
        excerpt: makeExcerpt([row.title, row.summary, row.content].filter(Boolean).join('\n\n'), q)
      }))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 20),
    entities: entityHits.rows
  }
})

function parseList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}
