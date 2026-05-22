export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  system: string
  user: string
  history?: ChatMessage[]
  /**
   * Override the runtimeConfig.openRouterModel for this single call.
   * Used by the threads UI to route a turn at Sonnet vs Opus etc.
   * Ignored by the Ollama and placeholder paths.
   */
  modelOverride?: string
  /** Optional max-tokens cap for this call. Defaults to MAX_TOKENS. */
  maxTokens?: number
}

export type ChatProvider = 'openrouter' | 'ollama' | 'placeholder'

export interface ChatResult {
  answer: string
  provider: ChatProvider
  model: string | null
  tokensIn: number | null
  tokensOut: number | null
}

export interface ChatStreamChunk {
  delta: string
}

export interface ChatStreamResult {
  /** Final assembled answer (concatenation of every delta). */
  answer: string
  provider: ChatProvider
  model: string | null
  tokensIn: number | null
  tokensOut: number | null
}

const MAX_HISTORY = 16
const MAX_TOKENS = 900

function pickModel(req: ChatRequest, fallback: string | undefined): string | null {
  return req.modelOverride || fallback || null
}

function buildMessages(req: ChatRequest): ChatMessage[] {
  return [
    { role: 'system', content: req.system },
    ...((req.history || []).slice(-MAX_HISTORY)),
    { role: 'user', content: req.user }
  ]
}

/**
 * Non-streaming chat completion. Same provider abstraction as
 * extractor.ts (openrouter | ollama | placeholder). Used by
 * /api/v1/chat for the single-turn surface and by the thread title
 * auto-generator.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const config = useRuntimeConfig()
  const provider = String(config.extractorProvider || 'placeholder')

  const messages = buildMessages(req)

  if (provider === 'openrouter' && config.openRouterApiKey) {
    const result = await callOpenRouter(messages, req)
    if (result) return result
  }

  if (provider === 'ollama') {
    const result = await callOllama(messages, req)
    if (result) return result
  }

  return placeholderResult()
}

/**
 * Streaming chat completion. Returns an async iterable of delta chunks
 * plus a final summary. The caller (typically the SSE endpoint) drives
 * the iteration and writes each chunk to the wire.
 *
 * Placeholder + Ollama paths fall back to a one-shot call followed by
 * a single delta - good enough for OSS defaults and rare ollama use
 * without complicating the loop.
 */
export async function* chatStream(req: ChatRequest): AsyncGenerator<ChatStreamChunk, ChatStreamResult, void> {
  const config = useRuntimeConfig()
  const provider = String(config.extractorProvider || 'placeholder')
  const messages = buildMessages(req)

  if (provider === 'openrouter' && config.openRouterApiKey) {
    const stream = streamOpenRouter(messages, req)
    let assembled = ''
    let model: string | null = pickModel(req, String(config.openRouterModel || ''))
    let tokensIn: number | null = null
    let tokensOut: number | null = null
    let any = false
    try {
      for await (const event of stream) {
        if (event.delta) {
          assembled += event.delta
          any = true
          yield { delta: event.delta }
        }
        if (event.model) model = event.model
        if (event.tokensIn != null) tokensIn = event.tokensIn
        if (event.tokensOut != null) tokensOut = event.tokensOut
      }
    } catch (error) {
      console.error('OpenRouter stream failed', error)
    }
    if (any) {
      return { answer: assembled.trim(), provider: 'openrouter', model, tokensIn, tokensOut }
    }
    // fall through to next provider on hard failure
  }

  if (provider === 'ollama') {
    const single = await callOllama(messages, req)
    if (single) {
      yield { delta: single.answer }
      return single
    }
  }

  const fallback = placeholderResult()
  yield { delta: fallback.answer }
  return fallback
}

function placeholderResult(): ChatResult {
  return {
    answer: 'LLM provider not configured. See the sources below for the most relevant captures.',
    provider: 'placeholder',
    model: null,
    tokensIn: null,
    tokensOut: null
  }
}

interface OpenRouterUsage {
  prompt_tokens?: number
  completion_tokens?: number
}

async function callOpenRouter(messages: ChatMessage[], req: ChatRequest): Promise<ChatResult | null> {
  const config = useRuntimeConfig()
  const model = pickModel(req, String(config.openRouterModel || '')) || String(config.openRouterModel || '')
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openRouterApiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'PKOS'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: req.maxTokens || MAX_TOKENS,
        messages
      })
    })
    if (!response.ok) return null
    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
      usage?: OpenRouterUsage
    }
    const answer = (json.choices?.[0]?.message?.content || '').trim()
    if (!answer) return null
    return {
      answer,
      provider: 'openrouter',
      model: json.model || model,
      tokensIn: json.usage?.prompt_tokens ?? null,
      tokensOut: json.usage?.completion_tokens ?? null
    }
  } catch {
    return null
  }
}

interface OpenRouterStreamEvent {
  delta?: string
  model?: string
  tokensIn?: number
  tokensOut?: number
}

async function* streamOpenRouter(messages: ChatMessage[], req: ChatRequest): AsyncGenerator<OpenRouterStreamEvent, void, void> {
  const config = useRuntimeConfig()
  const model = pickModel(req, String(config.openRouterModel || '')) || String(config.openRouterModel || '')
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openRouterApiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'PKOS',
      accept: 'text/event-stream'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: req.maxTokens || MAX_TOKENS,
      stream: true,
      messages
    })
  })
  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter stream failed: ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let seenModel = ''
  let lastUsage: OpenRouterUsage | undefined

  // OpenRouter follows OpenAI's SSE shape: `data: {...}\n\n`, plus a
  // final `data: [DONE]` sentinel. Tokens come on the second-to-last
  // chunk in the `usage` field when stream_options.include_usage is
  // set; OpenRouter includes it by default for paid providers.
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
          model?: string
          usage?: OpenRouterUsage
        }
        if (obj.model && !seenModel) seenModel = obj.model
        if (obj.usage) lastUsage = obj.usage
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) yield { delta }
      } catch {
        // Ignore single malformed line, keep reading.
      }
    }
  }

  yield {
    model: seenModel || model,
    tokensIn: lastUsage?.prompt_tokens,
    tokensOut: lastUsage?.completion_tokens
  }
}

async function callOllama(messages: ChatMessage[], req: ChatRequest): Promise<ChatResult | null> {
  const config = useRuntimeConfig()
  const model = String(config.ollamaModel || '')
  try {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.2, num_predict: req.maxTokens || MAX_TOKENS }
      })
    })
    if (!response.ok) return null
    const json = await response.json() as {
      message?: { content?: string }
      prompt_eval_count?: number
      eval_count?: number
    }
    const answer = (json.message?.content || '').trim()
    if (!answer) return null
    return {
      answer,
      provider: 'ollama',
      model,
      tokensIn: json.prompt_eval_count ?? null,
      tokensOut: json.eval_count ?? null
    }
  } catch {
    return null
  }
}
