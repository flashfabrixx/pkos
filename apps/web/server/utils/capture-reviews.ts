import type pg from 'pg'
import type { EntityType } from '@pkos/core'

/**
 * Capture Review Step (Sprint A).
 *
 * When the extractor surfaces a new entity name that doesn't match
 * any existing canonical_name exactly but DOES fuzzy-match an
 * existing entity in the unsure zone, we want to ask the user
 * "is this the same one?" before silently splitting the graph.
 *
 * Trigram similarity gives us a cheap, LLM-free check. Range
 * picked conservatively (see plan) so we don't flood the user.
 */

/** Below this we treat the candidate as unrelated → silent create. */
export const FUZZY_FLOOR = 0.4
/** Above this we treat the candidate as the same → silent link. */
export const FUZZY_CEILING = 0.85

export interface FuzzyCandidate {
  id: string
  name: string
  canonical_name: string
  similarity: number
}

/**
 * Find existing entities of the same type whose canonical_name is
 * "suggestively similar" to the new name — neither exact match nor
 * clearly different. Returns the best candidate in the unsure range,
 * or null when nothing fits.
 *
 * Exact matches (sim = 1.0) are filtered out because upsertEntity
 * already handles those via ON CONFLICT.
 */
export async function findFuzzyMatch(
  client: pg.PoolClient | pg.Pool,
  type: EntityType,
  canonicalName: string
): Promise<FuzzyCandidate | null> {
  const r = await client.query<FuzzyCandidate>(
    `SELECT id, name, canonical_name,
            similarity(canonical_name, $2) AS similarity
       FROM entities
      WHERE type = $1
        AND deleted_at IS NULL
        AND canonical_name <> $2
        AND similarity(canonical_name, $2) >= $3
        AND similarity(canonical_name, $2) <  $4
      ORDER BY similarity(canonical_name, $2) DESC
      LIMIT 1`,
    [type, canonicalName, FUZZY_FLOOR, FUZZY_CEILING]
  )
  return r.rows[0] || null
}

/**
 * Insert a capture_reviews row of kind entity_match. Used by the
 * extractor pipeline when findFuzzyMatch returns a hit on a freshly
 * upserted entity.
 *
 * Idempotent: if an open review already exists for the same
 * (document_id, kind, suggested target), it's a no-op.
 */
export async function emitEntityMatchReview(
  client: pg.PoolClient,
  params: {
    documentId: string
    newEntity: { id: string, name: string, type: EntityType }
    candidate: FuzzyCandidate
  }
) {
  const { documentId, newEntity, candidate } = params
  const payload = {
    extractedName: newEntity.name,
    entityType: newEntity.type
  }
  const suggestion = {
    newEntityId: newEntity.id,
    candidateEntityId: candidate.id,
    candidateName: candidate.name,
    similarity: candidate.similarity
  }
  await client.query(
    `INSERT INTO capture_reviews (document_id, kind, payload, suggestion)
     SELECT $1, 'entity_match', $2::jsonb, $3::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM capture_reviews
        WHERE document_id = $1
          AND kind = 'entity_match'
          AND status = 'open'
          AND suggestion->>'newEntityId' = $4
          AND suggestion->>'candidateEntityId' = $5
     )`,
    [documentId, JSON.stringify(payload), JSON.stringify(suggestion), newEntity.id, candidate.id]
  )
}
