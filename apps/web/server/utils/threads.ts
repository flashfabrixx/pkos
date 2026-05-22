/**
 * Helpers shared by the thread endpoints. Single source of truth for
 * which model slugs the UI can pick and which we accept on the wire.
 */
export const SUPPORTED_THREAD_MODELS = [
  'openrouter/anthropic/claude-haiku-4-5',
  'openrouter/anthropic/claude-sonnet-4-6',
  'openrouter/anthropic/claude-opus-4-7',
  'openrouter/google/gemini-2.5-flash',
  'openrouter/openai/gpt-4.1-mini'
] as const

export type ThreadModel = typeof SUPPORTED_THREAD_MODELS[number]

export const DEFAULT_THREAD_MODEL: ThreadModel = 'openrouter/anthropic/claude-sonnet-4-6'

export interface ThreadRow {
  id: string
  title: string
  model: string
  system_prompt: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface MessageRow {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources: unknown[] | null
  model: string | null
  provider: string | null
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}
