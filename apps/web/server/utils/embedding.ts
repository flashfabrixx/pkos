/**
 * Embedding provider routing. Multilingual-first: default models cover
 * German + English (and many more) without language detection on our side.
 *
 * Providers:
 *   - placeholder : no-op, returns null for every input (system still works)
 *   - ollama      : POST {OLLAMA_URL}/api/embed with model PKOS_EMBEDDING_MODEL (default bge-m3)
 *   - openai      : POST https://api.openai.com/v1/embeddings (text-embedding-3-small@1024)
 *
 * All calls are fail-open: any provider failure yields null for that input.
 * The DB schema reflects this — `embedding` columns are nullable.
 */

export const EMBEDDING_DIMENSION = 1024

export interface EmbeddingResult {
  vector: number[] | null
  provider: string
  model: string | null
}

import { logger } from './logger'

let warnedFailureKey: string | null = null

function warnOnce(key: string, message: string) {
  if (warnedFailureKey === key) return
  warnedFailureKey = key
  logger.warn({ component: 'embedding' }, message)
}

function pgVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  const config = useRuntimeConfig()
  const provider = ((config as { embeddingProvider?: string }).embeddingProvider || 'placeholder').toLowerCase()
  if (provider === 'placeholder' || !texts.length) {
    return texts.map(() => ({ vector: null, provider: 'placeholder', model: null }))
  }
  try {
    if (provider === 'ollama') return await embedWithOllama(texts, config)
    if (provider === 'openai') return await embedWithOpenAI(texts, config)
    warnOnce(`unknown:${provider}`, `Unknown PKOS_EMBEDDING_PROVIDER="${provider}". Falling back to placeholder.`)
    return texts.map(() => ({ vector: null, provider, model: null }))
  } catch (error) {
    warnOnce(`error:${provider}`, `Embedding via ${provider} failed: ${(error as Error).message}. Entries will be stored without embeddings.`)
    return texts.map(() => ({ vector: null, provider, model: null }))
  }
}

async function embedWithOllama(texts: string[], config: ReturnType<typeof useRuntimeConfig>): Promise<EmbeddingResult[]> {
  const url = ((config as { ollamaUrl?: string }).ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const model = (config as { embeddingModel?: string }).embeddingModel || 'bge-m3'
  // Ollama's modern /api/embed accepts string | string[] in `input`.
  const response = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts })
  })
  if (!response.ok) {
    throw new Error(`Ollama responded ${response.status}: ${await response.text().catch(() => '')}`)
  }
  const data = (await response.json()) as { embeddings?: number[][] }
  if (!Array.isArray(data.embeddings)) {
    throw new Error('Ollama returned no embeddings array')
  }
  return data.embeddings.map((vec) => ({
    vector: ensureDimension(vec, model),
    provider: 'ollama',
    model
  }))
}

async function embedWithOpenAI(texts: string[], config: ReturnType<typeof useRuntimeConfig>): Promise<EmbeddingResult[]> {
  const apiKey = (config as { openAIApiKey?: string }).openAIApiKey || ''
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const model = (config as { embeddingModel?: string }).embeddingModel || 'text-embedding-3-small'
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: texts, dimensions: EMBEDDING_DIMENSION, encoding_format: 'float' })
  })
  if (!response.ok) {
    throw new Error(`OpenAI responded ${response.status}: ${await response.text().catch(() => '')}`)
  }
  const data = (await response.json()) as { data?: Array<{ embedding: number[], index: number }> }
  if (!Array.isArray(data.data)) {
    throw new Error('OpenAI returned no data array')
  }
  const ordered: EmbeddingResult[] = new Array(texts.length).fill(null).map(() => ({ vector: null, provider: 'openai', model }))
  for (const row of data.data) {
    ordered[row.index] = {
      vector: ensureDimension(row.embedding, model),
      provider: 'openai',
      model
    }
  }
  return ordered
}

function ensureDimension(vec: number[], model: string): number[] | null {
  if (!Array.isArray(vec)) return null
  if (vec.length === EMBEDDING_DIMENSION) return vec
  warnOnce(
    `dim:${model}`,
    `Model "${model}" returned ${vec.length} dimensions, expected ${EMBEDDING_DIMENSION}. Truncating/padding to fit. Pick a model that matches or update the migration.`
  )
  if (vec.length > EMBEDDING_DIMENSION) return vec.slice(0, EMBEDDING_DIMENSION)
  const padded = vec.slice()
  while (padded.length < EMBEDDING_DIMENSION) padded.push(0)
  return padded
}

export function vectorToPg(vec: number[] | null): string | null {
  if (!vec) return null
  return pgVectorLiteral(vec)
}
