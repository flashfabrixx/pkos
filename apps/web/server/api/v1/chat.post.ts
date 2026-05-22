import { createError, readBody } from 'h3'
import { z } from 'zod'
import { requireAuthOrApiKey } from '../../utils/auth'
import { chatCompletion } from '../../utils/chat'
import { chatSystemPrompt, chatUserPrompt } from '../../utils/chat-prompts'
import { runHybridSearch } from '../../utils/search'

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(4000)
})

const filtersSchema = z.object({
  kinds: z.array(z.string()).optional(),
  lang: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
}).partial().optional()

const schema = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z.array(messageSchema).max(20).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  filters: filtersSchema
})

const DEFAULT_TOP_K = 8

/**
 * Retrieval-augmented chat. Runs the hybrid search internally, builds a
 * citation-tagged context, and lets the configured LLM provider draft an
 * answer. Falls back to a deterministic stub when no provider is wired up
 * (the caller can still display `sources`).
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'chat:read')
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  }

  const { question, history, topK, filters } = parsed.data
  const search = await runHybridSearch({
    q: question,
    kinds: filters?.kinds,
    lang: filters?.lang ?? null,
    dateFrom: filters?.from ?? null,
    dateTo: filters?.to ?? null,
    limit: topK ?? DEFAULT_TOP_K
  })

  const sources = search.results.slice(0, topK ?? DEFAULT_TOP_K)

  const completion = await chatCompletion({
    system: chatSystemPrompt(),
    user: chatUserPrompt(question, sources),
    history
  })

  return {
    mode: search.mode,
    answer: completion.answer,
    provider: completion.provider,
    sources: sources.map((row) => ({
      documentId: row.document_id,
      title: row.title,
      sourceType: row.source_type,
      capturedAt: row.captured_at,
      excerpt: row.excerpt,
      score: row.score
    }))
  }
})

