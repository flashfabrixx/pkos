import { logger } from '../../utils/logger'
import { query } from '../../utils/db'
import { TRASH_RETENTION_DAYS } from '../../utils/trash-retention'

/**
 * Hard-delete trash items older than TRASH_RETENTION_DAYS. The four
 * soft-delete-supporting tables (documents, entities, action_items,
 * comments) all carry a `deleted_at` column; rows whose deleted_at is
 * older than the cutoff get purged.
 *
 * Cascades:
 *   - documents → action_items / entity_mentions / comments (FK CASCADE)
 *   - entities  → entity_mentions / knowledge_edges (FK CASCADE),
 *                 action_items.person_id/project_id (SET NULL)
 *   - action_items, comments: no dependents
 */
export default defineTask({
  meta: {
    name: 'trash:purge',
    description: 'Hard-delete trash items older than the retention window.'
  },
  async run() {
    const cutoffExpr = `now() - interval '${TRASH_RETENTION_DAYS} days'`
    const tables = ['documents', 'entities', 'action_items', 'comments'] as const
    const counts: Record<string, number> = {}
    try {
      for (const table of tables) {
        const r = await query(
          `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffExpr}`
        )
        counts[table] = r.rowCount || 0
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      if (total > 0) {
        logger.info({ component: 'trash', counts }, `purged ${total} expired trash items`)
      }
      return { result: counts }
    } catch (error) {
      logger.error({ component: 'trash', err: (error as Error).message }, 'trash purge failed')
      throw error
    }
  }
})
