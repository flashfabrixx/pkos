import type { CaptureInput, ExtractedKnowledge } from '@bkos/core'
import { deriveCaptureMetadata, extractKnowledge } from '@bkos/ingest'

type CaptureDraft = Omit<CaptureInput, 'title'> & { title?: string }

interface ExtractorResult {
  input: CaptureInput
  extracted: ExtractedKnowledge
  provider: string
}

interface LlmExtraction {
  title?: string
  extracted: ExtractedKnowledge
}

export async function extractCapture(input: CaptureDraft): Promise<ExtractorResult> {
  const config = useRuntimeConfig()
  const provider = String(config.extractorProvider || 'placeholder')
  const preparedInput = prepareInput(input)

  if (provider === 'openrouter' && config.openRouterApiKey) {
    const llmResult = await tryOpenRouterExtraction(preparedInput)
    if (llmResult) return { input: applyLlmTitle(preparedInput, llmResult.title), extracted: llmResult.extracted, provider }
  }

  if (provider === 'ollama') {
    const llmResult = await tryOllamaExtraction(preparedInput)
    if (llmResult) return { input: applyLlmTitle(preparedInput, llmResult.title), extracted: llmResult.extracted, provider }
  }

  return {
    input: preparedInput,
    extracted: extractKnowledge(preparedInput),
    provider: 'placeholder'
  }
}

export function prepareInput(input: CaptureDraft): CaptureInput {
  const derived = deriveCaptureMetadata(input)
  return {
    ...input,
    title: derived.title,
    participants: input.participants?.trim() || derived.participants || undefined,
    project: input.project?.trim() || derived.project || undefined
  }
}

async function tryOpenRouterExtraction(input: CaptureInput) {
  const config = useRuntimeConfig()
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openRouterApiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'BKOS'
      },
      body: JSON.stringify({
        model: config.openRouterModel,
        temperature: 0.1,
        messages: [
          { role: 'system', content: extractionSystemPrompt() },
          { role: 'user', content: extractionUserPrompt(input) }
        ],
        response_format: { type: 'json_object' }
      })
    })
    if (!response.ok) return null
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return parseExtraction(json.choices?.[0]?.message?.content || '', input)
  } catch {
    return null
  }
}

async function tryOllamaExtraction(input: CaptureInput) {
  const config = useRuntimeConfig()
  try {
    const response = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        system: extractionSystemPrompt(),
        prompt: extractionUserPrompt(input),
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_predict: 900 }
      })
    })
    if (!response.ok) return null
    const json = await response.json() as { response?: string }
    return parseExtraction(json.response || '', input)
  } catch {
    return null
  }
}

function extractionSystemPrompt() {
  return `You extract structured business knowledge from transcripts and meeting notes.
Return only valid JSON with this schema:
{
  "title": "short title",
  "summary": "2-3 sentence summary",
  "people": ["Full Name"],
  "projects": ["Project or topic"],
  "actionItems": ["Concrete action"],
  "decisions": ["Decision"],
  "insights": ["Insight"],
  "openQuestions": ["Question"],
  "tags": ["lowercase-tag"]
}
Keep arrays concise. Do not invent people.`
}

function extractionUserPrompt(input: CaptureInput) {
  return JSON.stringify({
    title: input.title,
    sourceType: input.sourceType,
    participants: input.participants || '',
    project: input.project || '',
    date: input.capturedAt || '',
    confidentiality: input.confidentiality,
    rawText: input.rawText
  })
}

function parseExtraction(content: string, fallbackInput: CaptureInput): LlmExtraction | null {
  try {
    const parsed = JSON.parse(stripFences(content)) as Partial<ExtractedKnowledge> & { title?: string }
    const fallback = extractKnowledge(fallbackInput)
    return {
      title: stringValue(parsed.title),
      extracted: {
        summary: stringValue(parsed.summary) || fallback.summary,
        people: stringArray(parsed.people, fallback.people),
        projects: stringArray(parsed.projects, fallback.projects),
        actionItems: stringArray(parsed.actionItems, fallback.actionItems),
        decisions: stringArray(parsed.decisions, fallback.decisions),
        insights: stringArray(parsed.insights, fallback.insights),
        openQuestions: stringArray(parsed.openQuestions, fallback.openQuestions),
        tags: stringArray(parsed.tags, fallback.tags)
      }
    }
  } catch {
    return null
  }
}

function applyLlmTitle(input: CaptureInput, title?: string): CaptureInput {
  const cleaned = title?.trim()
  if (!cleaned) return input
  return { ...input, title: cleaned.slice(0, 180) }
}

function stripFences(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const cleaned = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  return cleaned.length ? [...new Set(cleaned)] : fallback
}
