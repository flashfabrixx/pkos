import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { chatCompletion } from '../../utils/chat'
import { chatSystemPrompt } from '../../utils/chat-prompts'
import { getPool, query } from '../../utils/db'
import { compileEntityExport } from '../../utils/entity-export'
import { loadFactsForEntityIds, renderFactsBlock } from '../../utils/entity-facts'

const schema = z.object({
  entityId: z.string().uuid(),
  /**
   * Briefing flavor. Reserved slots for future prompt templates; only
   * the generic "briefing" is wired up today.
   */
  kind: z.enum(['briefing', 'meeting-prep', 'recap']).optional().default('briefing'),
  /** Optional override; defaults to the strongest model for this task. */
  model: z.string().optional()
})

const DEFAULT_BRIEFING_MODEL = 'openrouter/anthropic/claude-opus-4-7'
const MAX_RECENT_DOCS_FOR_SOURCES = 12

const KIND_INSTRUCTIONS: Record<string, string> = {
  briefing: [
    'Marcel is about to engage with this entity (a person, project, or topic).',
    'Produce a tight briefing that covers, in this order: 1) the most recent',
    'context, 2) open action items and who owns them, 3) unresolved questions',
    'or decisions worth surfacing, 4) what to ask or push for next time. Stay',
    'concrete, name documents by their title where helpful. 6-12 sentences.'
  ].join(' '),
  'meeting-prep': [
    'Marcel has a meeting coming up that involves this entity. Prepare him in',
    '3 short blocks: 1) "What we agreed last time" (decisions + status of open',
    'actions), 2) "What is still open" (questions + actions without owner),',
    '3) "What to push for this meeting" (3 concrete suggestions).'
  ].join(' '),
  recap: [
    'Summarize what happened with this entity over the captures provided.',
    'Order events chronologically. End with a 1-sentence "current state"',
    'line that captures where things stand right now.'
  ].join(' ')
}

interface BriefingSource {
  documentId: string
  title: string
  sourceType: string
  capturedAt: string | null
  excerpt: string
  score: null
}

/**
 * Materialize a briefing thread for an entity. Server-side does the
 * three steps that the client would otherwise stitch together:
 *
 *   1. Compile the deterministic entity export (Markdown).
 *   2. Create a thread (Opus default, "Briefing: <name>" title) and
 *      insert the seeded user message.
 *   3. Run a single non-streaming LLM call and persist the assistant
 *      reply with sources / model / token counts.
 *
 * The endpoint waits for the full response and returns
 * `{threadId, messageId}`. The client navigates to /threads/<id> to
 * see the briefing rendered, then keeps refining via the standard
 * streaming messages endpoint.
 *
 * Cookie auth only.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = schema.parse(await readBody(event))

  const entityRes = await query<{ id: string, type: string, name: string }>(
    `SELECT id, type, name FROM entities WHERE id = $1 AND deleted_at IS NULL`,
    [body.entityId]
  )
  const entity = entityRes.rows[0]
  if (!entity) throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
  if (!['person', 'project', 'tag'].includes(entity.type)) {
    throw createError({ statusCode: 400, statusMessage: `Cannot brief on entity of type "${entity.type}"` })
  }

  const exportMarkdown = await compileEntityExport(getPool(), body.entityId)
  const sources = await loadEntitySources(body.entityId)

  // Always inject curated facts for the briefed entity - they are
  // the single most relevant context for a briefing.
  const factsByEntity = await loadFactsForEntityIds(getPool(), [body.entityId])
  const factsBlocks: string[] = []
  const ownFacts = factsByEntity.get(body.entityId)
  if (ownFacts && ownFacts.length) {
    const block = renderFactsBlock(entity.name, ownFacts)
    if (block) factsBlocks.push(block)
  }

  const model = body.model || DEFAULT_BRIEFING_MODEL
  const title = briefingTitle(body.kind, entity)

  const threadResult = await query<{ id: string }>(
    `INSERT INTO conversation_threads (title, model) VALUES ($1, $2) RETURNING id`,
    [title, model]
  )
  const threadId = threadResult.rows[0]!.id

  const userContent = renderUserPrompt(body.kind, entity, exportMarkdown)
  await query(
    `INSERT INTO conversation_messages (thread_id, role, content) VALUES ($1, 'user', $2)`,
    [threadId, userContent]
  )

  const completion = await chatCompletion({
    system: chatSystemPrompt({ extra: KIND_INSTRUCTIONS[body.kind], factsBlocks }),
    user: userContent,
    modelOverride: model,
    // Briefings are deliberately longer than a normal chat turn.
    maxTokens: 1600
  })

  const answer = completion.answer.trim() || '(no response)'
  const assistantInsert = await query<{ id: string }>(
    `INSERT INTO conversation_messages
       (thread_id, role, content, sources, model, provider, tokens_in, tokens_out)
     VALUES ($1, 'assistant', $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING id`,
    [
      threadId,
      answer,
      JSON.stringify(sources),
      completion.model,
      completion.provider,
      completion.tokensIn,
      completion.tokensOut
    ]
  )

  return {
    threadId,
    messageId: assistantInsert.rows[0]!.id,
    provider: completion.provider
  }
})

function briefingTitle(kind: string, entity: { name: string, type: string }) {
  const head = entity.type === 'tag' ? `#${entity.name}` : entity.name
  switch (kind) {
    case 'meeting-prep': return `Meeting prep: ${head}`
    case 'recap': return `Recap: ${head}`
    default: return `Briefing: ${head}`
  }
}

function renderUserPrompt(kind: string, entity: { name: string, type: string }, exportMarkdown: string) {
  const focus = entity.type === 'tag' ? `tag #${entity.name}` : `${entity.type} "${entity.name}"`
  const lines = [
    `Prepare a ${kind === 'meeting-prep' ? 'meeting prep' : kind === 'recap' ? 'recap' : 'briefing'} on the ${focus}.`,
    'Use the briefing material below as the only source of truth. Cite document titles inline when you reference them.',
    '',
    '--- briefing material (auto-compiled from PKOS) ---',
    exportMarkdown,
    '--- end of material ---'
  ]
  return lines.join('\n')
}

async function loadEntitySources(entityId: string): Promise<BriefingSource[]> {
  const r = await query<{
    document_id: string, title: string, source_type: string, captured_at: string | null, summary: string | null
  }>(
    `SELECT d.id AS document_id, d.title, d.source_type,
            d.captured_at::text AS captured_at, d.summary
     FROM documents d
     JOIN entity_mentions em ON em.document_id = d.id
     WHERE em.entity_id = $1 AND d.deleted_at IS NULL
     ORDER BY COALESCE(d.captured_at, d.created_at::date) DESC, d.created_at DESC
     LIMIT $2`,
    [entityId, MAX_RECENT_DOCS_FOR_SOURCES]
  )
  return r.rows.map((row) => ({
    documentId: row.document_id,
    title: row.title,
    sourceType: row.source_type,
    capturedAt: row.captured_at,
    excerpt: row.summary || '',
    score: null
  }))
}
