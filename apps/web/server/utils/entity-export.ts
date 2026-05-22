import type pg from 'pg'

const MAX_DOCUMENTS = 30
const MAX_ACTION_ITEMS = 50
const MAX_DECISIONS = 25
const MAX_INSIGHTS = 25
const MAX_OPEN_QUESTIONS = 25
const MAX_RELATED = 20
const MAX_COMMENTS = 20

type SupportedEntityType = 'person' | 'project' | 'tag'

interface EntityHeader {
  id: string
  type: SupportedEntityType
  name: string
  description: string | null
}

interface Stats {
  first_seen: string | null
  last_seen: string | null
  document_count: number
  actions_open: number
  actions_done: number
}

/**
 * Compile a Markdown briefing for a single entity (person / project / tag)
 * that consolidates every artifact PKOS knows about it: recent captures,
 * open action items, decisions, insights, open questions, related
 * entities (co-mentioned), and entity-level comments.
 *
 * Intended for "Copy as Markdown" exports so the user can paste the
 * full picture into a chat workbench (Claude etc.) without writing the
 * prompt-context-stuffing by hand.
 *
 * Returns a single string. Throws if the entity does not exist or is
 * not one of the supported types.
 */
export async function compileEntityExport(client: pg.PoolClient | pg.Pool, entityId: string): Promise<string> {
  const entityRes = await client.query<EntityHeader>(
    `SELECT id, type, name, (metadata->>'description') AS description
     FROM entities
     WHERE id = $1 AND deleted_at IS NULL`,
    [entityId]
  )
  const entity = entityRes.rows[0]
  if (!entity) throw new Error(`Entity ${entityId} not found`)
  if (!['person', 'project', 'tag'].includes(entity.type)) {
    throw new Error(`Entity ${entityId} has unsupported type "${entity.type}"`)
  }

  const stats = await loadStats(client, entityId, entity.type)
  const documents = await loadDocuments(client, entityId)
  const actions = await loadActionItems(client, entityId, entity.type)
  const decisions = await loadDecisions(client, entityId)
  const insights = await loadInsights(client, entityId)
  const openQuestions = await loadOpenQuestions(client, entityId)
  const related = await loadRelatedEntities(client, entityId)
  const comments = await loadComments(client, entityId)

  return renderMarkdown({
    entity,
    stats,
    documents,
    actions,
    decisions,
    insights,
    openQuestions,
    related,
    comments
  })
}

async function loadStats(client: pg.PoolClient | pg.Pool, entityId: string, type: SupportedEntityType): Promise<Stats> {
  const isPerson = type === 'person'
  const actionsOpenSql = isPerson
    ? `(SELECT COUNT(*)::int FROM action_items WHERE person_id = $1 AND status = 'open' AND deleted_at IS NULL)`
    : `(SELECT COUNT(*)::int FROM action_items a
        WHERE a.status = 'open' AND a.deleted_at IS NULL
          AND a.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1))`
  const actionsDoneSql = isPerson
    ? `(SELECT COUNT(*)::int FROM action_items WHERE person_id = $1 AND status = 'done' AND deleted_at IS NULL)`
    : `(SELECT COUNT(*)::int FROM action_items a
        WHERE a.status = 'done' AND a.deleted_at IS NULL
          AND a.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1))`

  const r = await client.query<Stats>(
    `SELECT
       (SELECT COUNT(DISTINCT em.document_id)::int FROM entity_mentions em
          JOIN documents d ON d.id = em.document_id
          WHERE em.entity_id = $1 AND d.deleted_at IS NULL) AS document_count,
       ${actionsOpenSql} AS actions_open,
       ${actionsDoneSql} AS actions_done,
       (SELECT MIN(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = $1 AND d.deleted_at IS NULL) AS first_seen,
       (SELECT MAX(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = $1 AND d.deleted_at IS NULL) AS last_seen`,
    [entityId]
  )
  return r.rows[0] || { first_seen: null, last_seen: null, document_count: 0, actions_open: 0, actions_done: 0 }
}

async function loadDocuments(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, title: string, source_type: string, captured_at: string | null, summary: string | null
  }>(
    `SELECT d.id, d.title, d.source_type, d.captured_at::text AS captured_at, d.summary
     FROM documents d
     JOIN entity_mentions em ON em.document_id = d.id
     WHERE em.entity_id = $1 AND d.deleted_at IS NULL
     ORDER BY COALESCE(d.captured_at, d.created_at::date) DESC, d.created_at DESC
     LIMIT $2`,
    [entityId, MAX_DOCUMENTS]
  )
  return r.rows
}

async function loadActionItems(client: pg.PoolClient | pg.Pool, entityId: string, type: SupportedEntityType) {
  // For people, action_items.person_id is the strong link. For other
  // types, fall back to "any action item in a document that mentions
  // this entity". Open items come first, then done, both by recency.
  const sql = type === 'person'
    ? `SELECT a.id, a.title, a.status, a.due_date::text AS due_date,
              d.title AS document_title, true AS direct
       FROM action_items a
       JOIN documents d ON d.id = a.document_id
       WHERE a.person_id = $1 AND a.deleted_at IS NULL AND d.deleted_at IS NULL
       ORDER BY (a.status = 'open') DESC,
                a.due_date NULLS LAST,
                a.created_at DESC
       LIMIT $2`
    : `SELECT a.id, a.title, a.status, a.due_date::text AS due_date,
              d.title AS document_title, false AS direct
       FROM action_items a
       JOIN documents d ON d.id = a.document_id
       WHERE a.deleted_at IS NULL AND d.deleted_at IS NULL
         AND a.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
       ORDER BY (a.status = 'open') DESC,
                a.due_date NULLS LAST,
                a.created_at DESC
       LIMIT $2`

  const r = await client.query<{
    id: string, title: string, status: string, due_date: string | null,
    document_title: string, direct: boolean
  }>(sql, [entityId, MAX_ACTION_ITEMS])
  return r.rows
}

async function loadDecisions(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, title: string, rationale: string | null, document_title: string, captured_at: string | null
  }>(
    `SELECT dec.id, dec.title, dec.rationale, d.title AS document_title, d.captured_at::text AS captured_at
     FROM decisions dec
     JOIN documents d ON d.id = dec.document_id
     WHERE d.deleted_at IS NULL
       AND dec.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
     ORDER BY COALESCE(d.captured_at, d.created_at::date) DESC, dec.created_at DESC
     LIMIT $2`,
    [entityId, MAX_DECISIONS]
  )
  return r.rows
}

async function loadInsights(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, title: string, document_title: string, captured_at: string | null
  }>(
    `SELECT i.id, i.title, d.title AS document_title, d.captured_at::text AS captured_at
     FROM insights i
     JOIN documents d ON d.id = i.document_id
     WHERE d.deleted_at IS NULL
       AND i.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
     ORDER BY COALESCE(d.captured_at, d.created_at::date) DESC, i.created_at DESC
     LIMIT $2`,
    [entityId, MAX_INSIGHTS]
  )
  return r.rows
}

async function loadOpenQuestions(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, title: string, status: string, document_title: string, captured_at: string | null
  }>(
    `SELECT q.id, q.title, q.status, d.title AS document_title, d.captured_at::text AS captured_at
     FROM open_questions q
     JOIN documents d ON d.id = q.document_id
     WHERE d.deleted_at IS NULL
       AND q.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
     ORDER BY (q.status = 'open') DESC,
              COALESCE(d.captured_at, d.created_at::date) DESC,
              q.created_at DESC
     LIMIT $2`,
    [entityId, MAX_OPEN_QUESTIONS]
  )
  return r.rows
}

async function loadRelatedEntities(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, type: string, name: string, co_mentions: number
  }>(
    `SELECT e.id, e.type, e.name, COUNT(DISTINCT em.document_id)::int AS co_mentions
     FROM entity_mentions em
     JOIN entities e ON e.id = em.entity_id
     JOIN documents d ON d.id = em.document_id
     WHERE em.document_id IN (SELECT document_id FROM entity_mentions WHERE entity_id = $1)
       AND e.id <> $1
       AND e.type IN ('person', 'project', 'tag')
       AND e.deleted_at IS NULL
       AND d.deleted_at IS NULL
     GROUP BY e.id, e.type, e.name
     ORDER BY co_mentions DESC, e.name ASC
     LIMIT $2`,
    [entityId, MAX_RELATED]
  )
  return r.rows
}

async function loadComments(client: pg.PoolClient | pg.Pool, entityId: string) {
  const r = await client.query<{
    id: string, body: string, created_at: string
  }>(
    `SELECT id, body, created_at::text AS created_at
     FROM comments
     WHERE entity_id = $1 AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT $2`,
    [entityId, MAX_COMMENTS]
  )
  return r.rows
}

function renderMarkdown(input: {
  entity: EntityHeader
  stats: Stats
  documents: Array<{ id: string, title: string, source_type: string, captured_at: string | null, summary: string | null }>
  actions: Array<{ title: string, status: string, due_date: string | null, document_title: string, direct: boolean }>
  decisions: Array<{ title: string, rationale: string | null, document_title: string, captured_at: string | null }>
  insights: Array<{ title: string, document_title: string, captured_at: string | null }>
  openQuestions: Array<{ title: string, status: string, document_title: string, captured_at: string | null }>
  related: Array<{ type: string, name: string, co_mentions: number }>
  comments: Array<{ body: string, created_at: string }>
}): string {
  const { entity, stats, documents, actions, decisions, insights, openQuestions, related, comments } = input
  const lines: string[] = []

  const heading = entity.type === 'person'
    ? `# Person: ${entity.name}`
    : entity.type === 'project'
      ? `# Project: ${entity.name}`
      : `# Tag: #${entity.name}`
  lines.push(heading)
  lines.push('')

  const meta: string[] = []
  if (stats.first_seen) meta.push(`First seen: ${stats.first_seen}`)
  if (stats.last_seen) meta.push(`Last seen: ${stats.last_seen}`)
  meta.push(`Documents: ${stats.document_count}`)
  meta.push(`Action items: ${stats.actions_open} open / ${stats.actions_done} done`)
  lines.push(meta.join('  ·  '))
  lines.push('')

  if (entity.description) {
    lines.push('## About')
    lines.push('')
    lines.push(entity.description.trim())
    lines.push('')
  }

  if (documents.length) {
    lines.push(`## Recent captures (${documents.length}${stats.document_count > documents.length ? ` of ${stats.document_count}` : ''})`)
    lines.push('')
    for (const doc of documents) {
      const date = doc.captured_at || 'undated'
      lines.push(`### ${date} · ${doc.source_type} · ${doc.title}`)
      if (doc.summary) {
        lines.push('')
        lines.push(doc.summary.trim())
      }
      lines.push('')
    }
  }

  const openActions = actions.filter((a) => a.status === 'open')
  const doneActions = actions.filter((a) => a.status === 'done')
  if (openActions.length) {
    lines.push(`## Open action items (${openActions.length})`)
    lines.push('')
    for (const a of openActions) {
      const due = a.due_date ? `**${a.due_date}**` : '(no due date)'
      const owner = entity.type === 'person' && a.direct ? '' : ` _(from ${a.document_title})_`
      lines.push(`- [ ] ${due} — ${a.title}${owner}`)
    }
    lines.push('')
  }
  if (doneActions.length) {
    lines.push(`## Closed action items (${doneActions.length})`)
    lines.push('')
    for (const a of doneActions) {
      lines.push(`- [x] ${a.title} _(from ${a.document_title})_`)
    }
    lines.push('')
  }

  if (decisions.length) {
    lines.push(`## Decisions (${decisions.length})`)
    lines.push('')
    for (const d of decisions) {
      const date = d.captured_at || 'undated'
      lines.push(`- **${date}** — ${d.title} _(from ${d.document_title})_`)
      if (d.rationale) {
        lines.push(`  > ${d.rationale.trim().replace(/\n+/g, ' ')}`)
      }
    }
    lines.push('')
  }

  if (insights.length) {
    lines.push(`## Insights (${insights.length})`)
    lines.push('')
    for (const i of insights) {
      const date = i.captured_at || 'undated'
      lines.push(`- **${date}** — ${i.title} _(from ${i.document_title})_`)
    }
    lines.push('')
  }

  if (openQuestions.length) {
    lines.push(`## Open questions (${openQuestions.length})`)
    lines.push('')
    for (const q of openQuestions) {
      const date = q.captured_at || 'undated'
      const marker = q.status === 'open' ? '?' : '✓'
      lines.push(`- ${marker} **${date}** — ${q.title} _(from ${q.document_title})_`)
    }
    lines.push('')
  }

  if (related.length) {
    const byType = { person: [] as typeof related, project: [] as typeof related, tag: [] as typeof related }
    for (const r of related) {
      if (r.type === 'person') byType.person.push(r)
      else if (r.type === 'project') byType.project.push(r)
      else if (r.type === 'tag') byType.tag.push(r)
    }
    lines.push('## Related entities')
    lines.push('')
    if (byType.person.length) {
      lines.push(`- People: ${byType.person.map((r) => `${r.name} (${r.co_mentions})`).join(', ')}`)
    }
    if (byType.project.length) {
      lines.push(`- Projects: ${byType.project.map((r) => `${r.name} (${r.co_mentions})`).join(', ')}`)
    }
    if (byType.tag.length) {
      lines.push(`- Tags: ${byType.tag.map((r) => `#${r.name} (${r.co_mentions})`).join(', ')}`)
    }
    lines.push('')
  }

  if (comments.length) {
    lines.push(`## Notes on this ${entity.type} (${comments.length})`)
    lines.push('')
    for (const c of comments) {
      const date = (c.created_at || '').slice(0, 10)
      lines.push(`- **${date}** — ${c.body.trim().replace(/\n+/g, ' ')}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`_Exported from PKOS on ${new Date().toISOString().slice(0, 10)}._`)

  return lines.join('\n')
}
