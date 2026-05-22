import { createError, getQuery, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { chatCompletion, chatStream } from '../../utils/chat'
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
 * Materialize a briefing thread for an entity.
 *
 * Default mode (POST without ?stream=1): the legacy non-streaming
 * path. Compiles entity export, creates the thread + seed message,
 * runs one LLM call, persists, returns `{threadId, messageId}`. The
 * client navigates to /threads/<id> once the response lands.
 *
 * Streaming mode (POST with ?stream=1): same pipeline but the LLM
 * call streams back to the client as Server-Sent Events using the
 * same wire format as `messages.post.ts`. The thread + user turn are
 * persisted before the first event so the client gets a usable
 * `threadId` immediately. The assistant turn is persisted on `done`.
 *
 *   event: thread     {threadId}
 *   event: user       {id, createdAt}
 *   event: sources    [BriefingSource]
 *   event: token      {delta}      (many)
 *   event: done       {messageId, model, provider, tokensIn, tokensOut}
 *   event: error      {message}
 *
 * Cookie auth only.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = schema.parse(await readBody(event))
  const wantsStream = getQuery(event).stream === '1'

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
  const userInsert = await query<{ id: string, created_at: string }>(
    `INSERT INTO conversation_messages (thread_id, role, content)
     VALUES ($1, 'user', $2)
     RETURNING id, created_at::text AS created_at`,
    [threadId, userContent]
  )
  const userMessage = userInsert.rows[0]!

  const systemPrompt = chatSystemPrompt({ extra: KIND_INSTRUCTIONS[body.kind], factsBlocks })

  if (!wantsStream) {
    const completion = await chatCompletion({
      system: systemPrompt,
      user: userContent,
      modelOverride: model,
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
  }

  // Streaming path.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventName: string, data: unknown) => {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        send('thread', { threadId })
        send('user', { id: userMessage.id, createdAt: userMessage.created_at })
        send('sources', sources)

        let assembled = ''
        let finalProvider = 'placeholder'
        let finalModel: string | null = model
        let tokensIn: number | null = null
        let tokensOut: number | null = null

        const iterator = chatStream({
          system: systemPrompt,
          user: userContent,
          modelOverride: model,
          maxTokens: 1600
        })

        while (true) {
          const { value, done } = await iterator.next()
          if (done) {
            if (value) {
              assembled = value.answer || assembled
              finalProvider = value.provider
              finalModel = value.model
              tokensIn = value.tokensIn
              tokensOut = value.tokensOut
            }
            break
          }
          if (value?.delta) {
            assembled += value.delta
            send('token', { delta: value.delta })
          }
        }

        const answer = assembled.trim() || '(no response)'
        const assistantInsert = await query<{ id: string }>(
          `INSERT INTO conversation_messages
             (thread_id, role, content, sources, model, provider, tokens_in, tokens_out)
           VALUES ($1, 'assistant', $2, $3::jsonb, $4, $5, $6, $7)
           RETURNING id`,
          [threadId, answer, JSON.stringify(sources), finalModel, finalProvider, tokensIn, tokensOut]
        )

        send('done', {
          messageId: assistantInsert.rows[0]!.id,
          model: finalModel,
          provider: finalProvider,
          tokensIn,
          tokensOut
        })
        controller.close()
      } catch (error: any) {
        console.error('briefing stream failed', error)
        try {
          send('error', { message: String(error?.message || 'stream failed') })
        } catch {
          // controller may already be torn down
        }
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no'
    }
  })
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
