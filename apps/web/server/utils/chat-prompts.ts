import type { SearchHit } from './search'

/**
 * System + user prompt builders shared between the single-shot
 * /api/v1/chat surface and the multi-turn thread endpoint. Same
 * citation contract on both so the answer style stays consistent
 * regardless of entry point.
 */

export interface ChatPromptOptions {
  /** Additional instructions injected as a trailing block. */
  extra?: string | null
  /**
   * Optional curated facts blocks (one per entity surfaced in
   * retrieval). Inserted between the base instructions and the
   * extra block so the model treats them as persistent context
   * rather than per-turn flavour.
   */
  factsBlocks?: string[]
}

const BASE_SYSTEM = [
  'You answer questions strictly from the provided sources. Cite each',
  'claim by appending the matching [doc-N] tag from the sources block.',
  'If the sources do not contain an answer, say so plainly. Reply in the',
  "user's language. Keep answers tight: 1-4 short sentences unless the",
  'user explicitly asks for detail. No filler, no apologies.'
].join(' ')

export function chatSystemPrompt(extraOrOptions?: string | null | ChatPromptOptions): string {
  const options: ChatPromptOptions = typeof extraOrOptions === 'string' || extraOrOptions === null || extraOrOptions === undefined
    ? { extra: extraOrOptions ?? null }
    : extraOrOptions

  const parts: string[] = [BASE_SYSTEM]
  const facts = (options.factsBlocks || []).filter((b) => b && b.trim())
  if (facts.length) {
    parts.push(`Curated context the user maintains (treat as long-term truth, but only use it when relevant):\n${facts.join('\n\n')}`)
  }
  if (options.extra && options.extra.trim()) {
    parts.push(`Additional instructions for this thread:\n${options.extra.trim()}`)
  }
  return parts.join('\n\n')
}

export function chatUserPrompt(question: string, sources: SearchHit[]): string {
  if (!sources.length) {
    return `Question:\n${question}\n\nSources:\n(no matches)\n\nAnswer:`
  }
  const block = sources
    .map((row, i) => {
      const head = [row.title, row.captured_at ? `(${row.captured_at})` : null].filter(Boolean).join(' ')
      return `[doc-${i + 1}] ${head}\n${row.excerpt}`
    })
    .join('\n\n')
  return `Question:\n${question}\n\nSources:\n${block}\n\nAnswer:`
}
