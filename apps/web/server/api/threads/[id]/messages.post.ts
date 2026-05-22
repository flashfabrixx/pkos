import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { chatCompletion, chatStream } from '../../../utils/chat'
import { chatSystemPrompt, chatUserPrompt } from '../../../utils/chat-prompts'
import { query } from '../../../utils/db'
import { runHybridSearch } from '../../../utils/search'
import type { MessageRow, ThreadRow } from '../../../utils/threads'

const schema = z.object({
  content: z.string().trim().min(1).max(4000),
  topK: z.number().int().min(1).max(20).optional()
})

const DEFAULT_TOP_K = 8
const RECENT_HISTORY = 16
const TITLE_PROMPT_MAX = 80

/**
 * Append a user turn to a thread and stream the assistant reply as
 * Server-Sent Events. On completion both messages are persisted with
 * the assistant's RAG sources, model + provider, and token counts.
 *
 * SSE protocol:
 *   event: user      payload: {id, createdAt}
 *   event: sources   payload: [{documentId, title, excerpt, score, ...}]
 *   event: token     payload: {delta: "..."}      (many)
 *   event: done      payload: {messageId, model, provider, tokensIn, tokensOut, title}
 *   event: error     payload: {message}           (on failure)
 *
 * The thread title is auto-rewritten from the first user turn (when it
 * still reads "New thread"). The "title" field on `done` lets the UI
 * patch its sidebar without a refresh.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const threadId = getRouterParam(event, 'id')
  if (!threadId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  // Read the thread + the recent history we'll feed the model. We do
  // this BEFORE writing the user turn so the history excludes it; the
  // user message is added explicitly as the last entry of the model
  // input later.
  const threadResult = await query<ThreadRow>(
    `SELECT id, title, model, system_prompt, metadata,
            created_at::text AS created_at, updated_at::text AS updated_at,
            archived_at::text AS archived_at
     FROM conversation_threads
     WHERE id = $1 AND deleted_at IS NULL`,
    [threadId]
  )
  const thread = threadResult.rows[0]
  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Thread not found' })

  const historyResult = await query<Pick<MessageRow, 'role' | 'content' | 'created_at'>>(
    `SELECT role, content, created_at
     FROM conversation_messages
     WHERE thread_id = $1 AND role IN ('user', 'assistant')
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [threadId, RECENT_HISTORY]
  )
  const history = [...historyResult.rows].reverse() // chronological

  // Persist the user turn.
  const userInsert = await query<{ id: string, created_at: string }>(
    `INSERT INTO conversation_messages (thread_id, role, content)
     VALUES ($1, 'user', $2)
     RETURNING id, created_at::text AS created_at`,
    [threadId, body.content]
  )
  const userMessage = userInsert.rows[0]!

  // Run the retrieval the assistant will cite.
  const search = await runHybridSearch({
    q: body.content,
    limit: body.topK ?? DEFAULT_TOP_K
  })
  const sources = search.results.slice(0, body.topK ?? DEFAULT_TOP_K)
  const sourcesPayload = sources.map((row) => ({
    documentId: row.document_id,
    title: row.title,
    sourceType: row.source_type,
    capturedAt: row.captured_at,
    excerpt: row.excerpt,
    score: row.score
  }))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventName: string, data: unknown) => {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      try {
        send('user', { id: userMessage.id, createdAt: userMessage.created_at })
        send('sources', sourcesPayload)

        let assembled = ''
        const iterator = chatStream({
          system: chatSystemPrompt(thread.system_prompt),
          user: chatUserPrompt(body.content, sources),
          history: history.map((h) => ({ role: h.role, content: h.content })),
          modelOverride: thread.model
        })

        let finalProvider = 'placeholder'
        let finalModel: string | null = thread.model
        let tokensIn: number | null = null
        let tokensOut: number | null = null

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
          [threadId, answer, JSON.stringify(sourcesPayload), finalModel, finalProvider, tokensIn, tokensOut]
        )
        const assistantMessageId = assistantInsert.rows[0]!.id

        // First-turn title generation. Best-effort; failures are
        // silent because the thread is fine without a fancy title.
        let nextTitle: string | null = null
        if (thread.title === 'New thread' && history.length === 0) {
          nextTitle = await generateThreadTitle(body.content, thread.model)
          if (nextTitle) {
            await query(
              `UPDATE conversation_threads SET title = $1, updated_at = now() WHERE id = $2`,
              [nextTitle, threadId]
            )
          }
        }

        send('done', {
          messageId: assistantMessageId,
          model: finalModel,
          provider: finalProvider,
          tokensIn,
          tokensOut,
          title: nextTitle
        })
        controller.close()
      } catch (error: any) {
        console.error('thread stream failed', error)
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
      // Disable proxy buffering (nginx in particular).
      'x-accel-buffering': 'no'
    }
  })
})

/**
 * Ask the configured model for a tight 4-7 word title in the same
 * language as the user message. Falls back to a truncated copy of the
 * user content if the model is unavailable.
 */
async function generateThreadTitle(content: string, model: string): Promise<string | null> {
  const trimmed = content.trim().slice(0, 800)
  try {
    const result = await chatCompletion({
      system: 'You produce 4-7 word thread titles in the user\'s language. No quotes, no trailing punctuation, no preamble. Title-case for English, sentence case for other languages.',
      user: `User message:\n${trimmed}\n\nTitle:`,
      modelOverride: model,
      maxTokens: 60
    })
    const raw = result.answer.trim().replace(/^["'`]+|["'`]+$/g, '')
    if (!raw) return null
    return raw.split('\n')[0]!.slice(0, TITLE_PROMPT_MAX)
  } catch {
    return trimmed.slice(0, TITLE_PROMPT_MAX)
  }
}

