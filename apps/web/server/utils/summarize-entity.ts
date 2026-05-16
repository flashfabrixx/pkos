import { query } from './db'
import { logger } from './logger'

const PROMPT_TEMPLATE = `You are summarising what BKOS knows about one entity in 2-3 concise sentences.
Use the provided context (documents, comments, activity). Stay factual; do not invent.
Write in the same language the context predominantly uses. No headings, no markdown.

Entity:
{ENTITY}

Context:
{CONTEXT}

Summary:`

interface SummaryContext {
  entityId: string
  type: string
  name: string
  description: string | null
  mentions: Array<{ document_title: string, excerpt: string | null, captured_at: string | null }>
  comments: Array<{ body: string, created_at: string }>
  activities: Array<{ kind: string, payload: Record<string, unknown>, occurred_at: string }>
}

export async function buildSummaryContext(entityId: string): Promise<SummaryContext | null> {
  const entity = await query<{ id: string, type: string, name: string, metadata: any }>(
    `SELECT id, type, name, metadata FROM entities WHERE id = $1 AND deleted_at IS NULL`,
    [entityId]
  )
  const row = entity.rows[0]
  if (!row) return null

  const [mentions, comments, activities] = await Promise.all([
    query<{ document_title: string, excerpt: string | null, captured_at: string | null }>(
      `SELECT d.title AS document_title, em.excerpt, d.captured_at::text AS captured_at
         FROM entity_mentions em
         JOIN documents d ON d.id = em.document_id
        WHERE em.entity_id = $1 AND d.deleted_at IS NULL
        ORDER BY d.captured_at DESC NULLS LAST, d.created_at DESC
        LIMIT 20`,
      [entityId]
    ),
    query<{ body: string, created_at: string }>(
      `SELECT body, created_at FROM comments WHERE entity_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`,
      [entityId]
    ),
    query<{ kind: string, payload: Record<string, unknown>, occurred_at: string }>(
      `SELECT kind, payload, occurred_at FROM entity_activities WHERE entity_id = $1 ORDER BY occurred_at DESC LIMIT 20`,
      [entityId]
    )
  ])

  return {
    entityId,
    type: row.type,
    name: row.name,
    description: typeof row.metadata?.description === 'string' ? row.metadata.description : null,
    mentions: mentions.rows,
    comments: comments.rows,
    activities: activities.rows
  }
}

function formatContext(ctx: SummaryContext): { entity: string, context: string } {
  const entityLine = ctx.description
    ? `${ctx.type}: ${ctx.name}\nDescription: ${ctx.description}`
    : `${ctx.type}: ${ctx.name}`

  const lines: string[] = []
  if (ctx.mentions.length) {
    lines.push('Documents that mention this entity:')
    for (const m of ctx.mentions.slice(0, 12)) {
      const excerpt = m.excerpt ? ` — "${m.excerpt.slice(0, 200)}"` : ''
      lines.push(`- ${m.document_title}${excerpt}`)
    }
  }
  if (ctx.comments.length) {
    lines.push('Recent comments:')
    for (const c of ctx.comments.slice(0, 8)) {
      lines.push(`- ${c.body.slice(0, 240)}`)
    }
  }
  if (ctx.activities.length) {
    lines.push('Recent activity:')
    for (const a of ctx.activities.slice(0, 10)) {
      const summary = describeActivity(a.kind, a.payload)
      if (summary) lines.push(`- ${summary}`)
    }
  }
  return { entity: entityLine, context: lines.join('\n') || '(no further context)' }
}

function describeActivity(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'mentioned_in_document':
      return `mentioned in a document`
    case 'assigned_to_action':
      return `assigned to action "${(payload as any).action_title || ''}"`
    case 'unassigned_from_action':
      return `unassigned from action "${(payload as any).action_title || ''}"`
    case 'renamed':
      return `renamed from "${(payload as any).from || ''}" to "${(payload as any).to || ''}"`
    case 'description_updated':
      return `description updated`
    case 'commented':
      return `received a comment`
    case 'received_merge_from':
      return `merged with ${(payload as any).merged?.length || 0} duplicate(s)`
    case 'created':
      return `entity created`
    default:
      return kind
  }
}

async function callProvider(prompt: string): Promise<string | null> {
  const config = useRuntimeConfig()
  const provider = String((config as { extractorProvider?: string }).extractorProvider || 'placeholder')

  if (provider === 'openrouter') {
    const apiKey = (config as { openRouterApiKey?: string }).openRouterApiKey || ''
    if (!apiKey) return null
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: (config as { openRouterModel?: string }).openRouterModel || 'openai/gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.2
      })
    })
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text().catch(() => '')}`)
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content?.trim() || null
  }

  if (provider === 'ollama') {
    const url = ((config as { ollamaUrl?: string }).ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '')
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: (config as { ollamaModel?: string }).ollamaModel || 'gemma4:e4b',
        prompt,
        stream: false
      })
    })
    if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text().catch(() => '')}`)
    const data = await response.json() as { response?: string }
    return data.response?.trim() || null
  }

  return null
}

export async function summariseEntity(entityId: string): Promise<{ summary: string | null, state: 'fresh' | 'failed' | 'absent' }> {
  // Reserve the entity so we don't kick off parallel summary jobs.
  await query(`UPDATE entities SET summary_state = 'generating' WHERE id = $1 AND summary_state <> 'generating'`, [entityId])

  const ctx = await buildSummaryContext(entityId)
  if (!ctx) {
    return { summary: null, state: 'absent' }
  }
  if (!ctx.mentions.length && !ctx.comments.length && !ctx.activities.length) {
    await query(
      `UPDATE entities SET summary = NULL, summary_state = 'absent', summary_updated_at = now() WHERE id = $1`,
      [entityId]
    )
    return { summary: null, state: 'absent' }
  }

  const formatted = formatContext(ctx)
  const prompt = PROMPT_TEMPLATE.replace('{ENTITY}', formatted.entity).replace('{CONTEXT}', formatted.context)

  let summary: string | null = null
  try {
    summary = await callProvider(prompt)
  } catch (error) {
    logger.warn({ component: 'summary', entity_id: entityId, err: (error as Error).message }, 'provider call failed')
    await query(`UPDATE entities SET summary_state = 'failed', summary_updated_at = now() WHERE id = $1`, [entityId])
    return { summary: null, state: 'failed' }
  }

  if (!summary) {
    await query(`UPDATE entities SET summary_state = 'failed', summary_updated_at = now() WHERE id = $1`, [entityId])
    return { summary: null, state: 'failed' }
  }

  await query(
    `UPDATE entities SET summary = $1, summary_state = 'fresh', summary_updated_at = now() WHERE id = $2`,
    [summary, entityId]
  )
  return { summary, state: 'fresh' }
}
