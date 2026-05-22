import type pg from 'pg'

export interface FactRow {
  id: string
  entity_id: string
  body: string
  position: number
  created_at: string
  updated_at: string
}

/**
 * Load facts grouped by entity id. Used by the chat + briefing
 * pipelines to inject the user's curated bullet points into the model
 * context whenever an entity surfaces in retrieval.
 */
export async function loadFactsForEntityIds(
  client: pg.PoolClient | pg.Pool,
  entityIds: string[]
): Promise<Map<string, FactRow[]>> {
  const result = new Map<string, FactRow[]>()
  if (!entityIds.length) return result
  const r = await client.query<FactRow>(
    `SELECT id, entity_id, body, position,
            created_at::text AS created_at,
            updated_at::text AS updated_at
     FROM entity_facts
     WHERE entity_id = ANY($1::uuid[])
     ORDER BY entity_id, position ASC, created_at ASC`,
    [entityIds]
  )
  for (const row of r.rows) {
    const list = result.get(row.entity_id) || []
    list.push(row)
    result.set(row.entity_id, list)
  }
  return result
}

/**
 * Format facts for a single entity as a compact block ready to drop
 * into a system prompt. Returns null when the entity has no facts so
 * the caller can skip the section entirely.
 */
export function renderFactsBlock(entityName: string, facts: FactRow[]): string | null {
  if (!facts.length) return null
  const lines = facts.map((f) => `- ${f.body.trim()}`)
  return `Facts to remember about ${entityName}:\n${lines.join('\n')}`
}
