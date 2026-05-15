import type pg from 'pg'
import { query as topLevelQuery } from './db'

export type ActivityKind =
  | 'created'
  | 'mentioned_in_document'
  | 'assigned_to_action'
  | 'unassigned_from_action'
  | 'linked_to_project'
  | 'unlinked_from_project'
  | 'renamed'
  | 'description_updated'
  | 'commented'
  | 'merged_into'
  | 'received_merge_from'

interface RecordActivityOptions {
  entityId: string
  kind: ActivityKind
  documentId?: string | null
  payload?: Record<string, unknown>
  /** Pass a transaction client when the activity belongs to an outer tx. */
  client?: pg.PoolClient
}

export async function recordActivity(options: RecordActivityOptions): Promise<void> {
  const run = options.client
    ? (sql: string, params: unknown[]) => options.client!.query(sql, params)
    : (sql: string, params: unknown[]) => topLevelQuery(sql, params)

  await run(
    `INSERT INTO entity_activities (entity_id, kind, source_document_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      options.entityId,
      options.kind,
      options.documentId || null,
      JSON.stringify(options.payload || {})
    ]
  )

  // Any activity invalidates the cached summary.
  await run(
    `UPDATE entities
     SET summary_state = CASE WHEN summary IS NULL THEN 'absent' ELSE 'stale' END
     WHERE id = $1 AND summary_state NOT IN ('generating')`,
    [options.entityId]
  )
}

export async function readActivities(entityId: string, limit = 100) {
  const result = await topLevelQuery(
    `SELECT a.id, a.kind, a.payload, a.occurred_at,
            a.source_document_id,
            d.title AS source_document_title
       FROM entity_activities a
       LEFT JOIN documents d ON d.id = a.source_document_id
      WHERE a.entity_id = $1
      ORDER BY a.occurred_at DESC
      LIMIT $2`,
    [entityId, limit]
  )
  return result.rows
}
