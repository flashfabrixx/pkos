import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const type = typeof params.type === 'string' && params.type !== 'all' ? params.type : null
  const relation = typeof params.relation === 'string' && params.relation !== 'all' ? params.relation : null
  const limit = Number(params.limit || 120)

  const edgeWhere = relation
    ? 'WHERE ke.relation_type = $1 AND (d.id IS NULL OR d.deleted_at IS NULL)'
    : 'WHERE (d.id IS NULL OR d.deleted_at IS NULL)'
  const edgeValues = relation ? [relation, limit] : [limit]
  const edgeLimitPlaceholder = relation ? '$2' : '$1'

  const edges = await query<{
    id: string
    source: string
    target: string
    relation_type: string
    document_id: string | null
    document_title: string | null
    evidence_excerpt: string | null
    confidence: number
  }>(
    `SELECT
       ke.id,
       ke.source_entity_id AS source,
       ke.target_entity_id AS target,
       ke.relation_type,
       ke.document_id,
       d.title AS document_title,
       ke.evidence_excerpt,
       ke.confidence
     FROM knowledge_edges ke
     LEFT JOIN documents d ON d.id = ke.document_id
     ${edgeWhere}
     ORDER BY ke.created_at DESC
     LIMIT ${edgeLimitPlaceholder}`,
    edgeValues
  )

  const nodeIds = [...new Set(edges.rows.flatMap((edge) => [edge.source, edge.target]))]
  if (!nodeIds.length) return { nodes: [], edges: [] }

  const nodeTypeClause = type ? 'AND e.type = $2' : ''
  const nodeValues = type ? [nodeIds, type] : [nodeIds]
  const nodes = await query<{
    id: string
    type: string
    name: string
    canonical_name: string
    mentions: string
  }>(
    `SELECT
       e.id,
       e.type,
       e.name,
       e.canonical_name,
       COUNT(em.id)::text AS mentions
     FROM entities e
     LEFT JOIN entity_mentions em ON em.entity_id = e.id
     WHERE e.id = ANY($1::uuid[]) AND e.deleted_at IS NULL
     ${nodeTypeClause}
     GROUP BY e.id
     ORDER BY COUNT(em.id) DESC, e.name
     LIMIT 120`,
    nodeValues
  )

  const visibleNodeIds = new Set(nodes.rows.map((node) => node.id))
  return {
    nodes: nodes.rows.map((node) => ({ ...node, mentions: Number(node.mentions) })),
    edges: edges.rows.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
  }
})
