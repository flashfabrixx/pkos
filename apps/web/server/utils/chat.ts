export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  system: string
  user: string
  history?: ChatMessage[]
}

export interface ChatResult {
  answer: string
  provider: 'openrouter' | 'ollama' | 'placeholder'
}

const MAX_HISTORY = 8
const MAX_TOKENS = 700

/**
 * Thin wrapper that reuses the existing extractor provider abstraction
 * (openrouter | ollama | placeholder) for chat-style completions. No new
 * SDK or env var: relies on `extractorProvider`, `openRouterApiKey`,
 * `openRouterModel`, `ollamaUrl`, `ollamaModel` from runtimeConfig.
 *
 * Placeholder returns a deterministic stub so OSS defaults keep working
 * — the caller is expected to surface the retrieved sources separately.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const config = useRuntimeConfig()
  const provider = String(config.extractorProvider || 'placeholder')

  const messages: ChatMessage[] = [
    { role: 'system', content: req.system },
    ...((req.history || []).slice(-MAX_HISTORY)),
    { role: 'user', content: req.user }
  ]

  if (provider === 'openrouter' && config.openRouterApiKey) {
    const answer = await callOpenRouter(messages)
    if (answer) return { answer, provider: 'openrouter' }
  }

  if (provider === 'ollama') {
    const answer = await callOllama(messages)
    if (answer) return { answer, provider: 'ollama' }
  }

  return {
    answer: 'LLM provider not configured. See the sources below for the most relevant captures.',
    provider: 'placeholder'
  }
}

async function callOpenRouter(messages: ChatMessage[]): Promise<string | null> {
  const config = useRuntimeConfig()
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
        model: config.openRouterModel,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        messages
      })
    })
    if (!response.ok) return null
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return (json.choices?.[0]?.message?.content || '').trim() || null
  } catch {
    return null
  }
}

async function callOllama(messages: ChatMessage[]): Promise<string | null> {
  const config = useRuntimeConfig()
  try {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages,
        stream: false,
        options: { temperature: 0.2, num_predict: MAX_TOKENS }
      })
    })
    if (!response.ok) return null
    const json = await response.json() as { message?: { content?: string } }
    return (json.message?.content || '').trim() || null
  } catch {
    return null
  }
}
