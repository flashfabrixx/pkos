import type { SearchHit } from './search'

/**
 * System + user prompt builders shared between the single-shot
 * /api/v1/chat surface and the multi-turn thread endpoint. Same
 * citation contract on both so the answer style stays consistent
 * regardless of entry point.
 */

export function chatSystemPrompt(extra?: string | null): string {
  const base = [
    'You answer questions strictly from the provided sources. Cite each',
    'claim by appending the matching [doc-N] tag from the sources block.',
    'If the sources do not contain an answer, say so plainly. Reply in the',
    "user's language. Keep answers tight: 1-4 short sentences unless the",
    'user explicitly asks for detail. No filler, no apologies.'
  ].join(' ')
  if (!extra || !extra.trim()) return base
  return `${base}\n\nAdditional instructions for this thread:\n${extra.trim()}`
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
