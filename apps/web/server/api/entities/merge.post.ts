import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'
import { withTransaction } from '../../utils/db'
import { canonicalize } from '../../utils/canonicalize'
import { recordActivity } from '../../utils/entity-activity'

const schema = z.object({
  primaryId: z.string().uuid(),
  mergeIds: z.array(z.string().uuid()).min(1).max(20),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional()
})

const MERGEABLE_TYPES = new Set(['person', 'project', 'tag'])

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const body = schema.parse(await readBody(event))
  const allIds = [body.primaryId, ...body.mergeIds]
  if (allIds.includes(body.primaryId) === false || body.mergeIds.includes(body.primaryId)) {
    throw createError({ statusCode: 400, statusMessage: 'mergeIds must not include primaryId' })
  }
  if (new Set(allIds).size !== allIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Duplicate ids supplied' })
  }

  return withTransaction(async (client) => {
    const entitiesResult = await client.query<{ id: string, type: string, name: string }>(
      `SELECT id, type, name FROM entities WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [allIds]
    )
    const rows = entitiesResult.rows
    if (rows.length !== allIds.length) {
      throw createError({ statusCode: 404, statusMessage: 'One or more entities not found' })
    }
    const types = new Set(rows.map((row) => row.type))
    if (types.size !== 1) {
      throw createError({ statusCode: 400, statusMessage: 'All entities must share the same type' })
    }
    const [type] = types
    if (!MERGEABLE_TYPES.has(type!)) {
      throw createError({ statusCode: 403, statusMessage: `Entity type '${type}' cannot be merged` })
    }

    const primary = rows.find((row) => row.id === body.primaryId)
    if (!primary) {
      throw createError({ statusCode: 404, statusMessage: 'Primary entity not found' })
    }

    // Move entity_mentions: insert into primary the ones that don't already exist
    await client.query(
      `INSERT INTO entity_mentions (entity_id, document_id, excerpt, confidence)
       SELECT $1, document_id, excerpt, confidence
       FROM entity_mentions
       WHERE entity_id = ANY($2::uuid[])
       ON CONFLICT (entity_id, document_id, excerpt) DO NOTHING`,
      [body.primaryId, body.mergeIds]
    )
    await client.query(`DELETE FROM entity_mentions WHERE entity_id = ANY($1::uuid[])`, [body.mergeIds])

    // Move knowledge_edges (source side): copy to primary, then delete originals
    await client.query(
      `INSERT INTO knowledge_edges (source_entity_id, target_entity_id, relation_type, document_id, evidence_excerpt, confidence)
       SELECT $1, target_entity_id, relation_type, document_id, evidence_excerpt, confidence
       FROM knowledge_edges
       WHERE source_entity_id = ANY($2::uuid[])
         AND target_entity_id <> $1
       ON CONFLICT (source_entity_id, target_entity_id, relation_type, document_id) DO NOTHING`,
      [body.primaryId, body.mergeIds]
    )
    await client.query(`DELETE FROM knowledge_edges WHERE source_entity_id = ANY($1::uuid[])`, [body.mergeIds])

    // Move knowledge_edges (target side)
    await client.query(
      `INSERT INTO knowledge_edges (source_entity_id, target_entity_id, relation_type, document_id, evidence_excerpt, confidence)
       SELECT source_entity_id, $1, relation_type, document_id, evidence_excerpt, confidence
       FROM knowledge_edges
       WHERE target_entity_id = ANY($2::uuid[])
         AND source_entity_id <> $1
       ON CONFLICT (source_entity_id, target_entity_id, relation_type, document_id) DO NOTHING`,
      [body.primaryId, body.mergeIds]
    )
    await client.query(`DELETE FROM knowledge_edges WHERE target_entity_id = ANY($1::uuid[])`, [body.mergeIds])

    // Move comments
    await client.query(
      `UPDATE comments SET entity_id = $1 WHERE entity_id = ANY($2::uuid[])`,
      [body.primaryId, body.mergeIds]
    )

    // Reassign action_items.person_id and project_id
    await client.query(
      `UPDATE action_items SET person_id = $1 WHERE person_id = ANY($2::uuid[])`,
      [body.primaryId, body.mergeIds]
    )
    await client.query(
      `UPDATE action_items SET project_id = $1 WHERE project_id = ANY($2::uuid[])`,
      [body.primaryId, body.mergeIds]
    )

    // Optionally update primary's name and/or description
    const updates: string[] = []
    const values: Array<string | null> = []
    if (body.name && body.name !== primary.name) {
      values.push(body.name)
      updates.push(`name = $${values.length}`)
      values.push(canonicalize(body.name))
      updates.push(`canonical_name = $${values.length}`)
    }
    if (body.description !== undefined) {
      values.push(JSON.stringify({ description: body.description || null }))
      updates.push(`metadata = metadata || $${values.length}::jsonb`)
    }
    if (updates.length) {
      values.push(body.primaryId)
      await client.query(
        `UPDATE entities SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length}`,
        values
      )
    }

    // Record a single activity on the survivor before the losers vanish.
    const losers = rows.filter((row) => row.id !== body.primaryId)
    await recordActivity({
      client,
      entityId: body.primaryId,
      kind: 'received_merge_from',
      payload: { merged: losers.map((row) => ({ id: row.id, name: row.name })) }
    })

    // Delete the merged-out entities
    await client.query(`DELETE FROM entities WHERE id = ANY($1::uuid[])`, [body.mergeIds])

    await recordAudit({
      event,
      actor,
      action: 'entity.merge',
      resourceKind: 'entity',
      resourceId: body.primaryId,
      meta: { merged_ids: body.mergeIds }
    })
    return { merged: true, primaryId: body.primaryId, mergedCount: body.mergeIds.length }
  })
})
