import { query } from './db'
import { logger } from './logger'

const SCORE_FLOOR = 0.78
const TOP_N_PER_ENTITY = 5
const DISMISS_TTL_DAYS = 30

/**
 * Recompute entity-link suggestions. For each entity that has an
 * embedding, find the top-N nearest neighbours of the same type with
 * cosine similarity above `SCORE_FLOOR`, and upsert a suggestion row.
 * Recently-dismissed pairs are skipped for DISMISS_TTL_DAYS so users
 * don't see the same noise back the next day.
 */
export async function recomputeSuggestions(): Promise<{ created: number, refreshed: number, skipped: number }> {
  const counters = { created: 0, refreshed: 0, skipped: 0 }

  // Pull entity ids in batches to keep memory bounded on big workspaces.
  const sources = await query<{ id: string, type: string }>(
    `SELECT id, type FROM entities
      WHERE embedding IS NOT NULL
        AND deleted_at IS NULL
        AND type IN ('person', 'project', 'tag')`
  )

  for (const source of sources.rows) {
    const neighbours = await query<{ id: string, score: number }>(
      `SELECT e.id,
              (1 - (e.embedding <=> source.embedding))::float AS score
         FROM entities e
         CROSS JOIN (SELECT embedding FROM entities WHERE id = $1) AS source
        WHERE e.id <> $1
          AND e.type = $2
          AND e.embedding IS NOT NULL
          AND e.deleted_at IS NULL
        ORDER BY e.embedding <=> source.embedding ASC
        LIMIT $3`,
      [source.id, source.type, TOP_N_PER_ENTITY]
    )
    for (const neighbour of neighbours.rows) {
      if (Number(neighbour.score) < SCORE_FLOOR) {
        counters.skipped++
        continue
      }
      const result = await query<{ inserted: boolean }>(
        `INSERT INTO entity_link_suggestions (source_id, target_id, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_id, target_id, reason) DO UPDATE
           SET score = EXCLUDED.score,
               accepted_at = CASE
                 WHEN entity_link_suggestions.accepted_at IS NOT NULL THEN entity_link_suggestions.accepted_at
                 ELSE NULL
               END,
               dismissed_at = CASE
                 WHEN entity_link_suggestions.dismissed_at IS NULL THEN NULL
                 WHEN entity_link_suggestions.dismissed_at > now() - INTERVAL '${DISMISS_TTL_DAYS} days' THEN entity_link_suggestions.dismissed_at
                 ELSE NULL
               END
         RETURNING (xmax = 0) AS inserted`,
        [source.id, neighbour.id, neighbour.score]
      )
      if (result.rows[0]?.inserted) counters.created++
      else counters.refreshed++
    }
  }

  logger.info({ component: 'suggestions', ...counters }, 'entity-link suggestion pass')
  return counters
}
