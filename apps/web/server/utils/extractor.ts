import type { CaptureInput, ExtractedKnowledge } from '@pkos/core'
import { deriveCaptureMetadata, extractKnowledge } from '@pkos/ingest'

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
        'X-Title': 'PKOS'
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

// Exposed for tests so we can assert the prompt's structural rules.
export function extractionSystemPrompt() {
  return `You are PKOS' knowledge extractor. You read a single document and emit
a tight JSON object that captures only what is actually present and useful.

# Output contract

Return ONLY valid JSON, no prose around it, matching exactly this schema:

{
  "title": string,                  // 4-12 words, no trailing punctuation
  "summary": string,                // 2-3 sentences, PLAIN TEXT only
  "people": string[],               // real participants, full names if known
  "projects": string[],             // products / initiatives / topic-as-project
  "actionItems": string[],          // concrete next steps, imperative voice
  "decisions": string[],            // declarative, what was decided
  "insights": string[],             // abstract observations worth keeping
  "openQuestions": string[],        // unresolved threads to follow up on
  "tags": string[]                  // lowercase-with-hyphens, content topics
}

# Hard rules — read carefully

1. **No transcript artifacts** anywhere in the output. Strip timestamps
   ("[00:12:34]", "12:34:56", "00:00"), speaker headers ("Marcel Bender:",
   "Speaker 1:"), filler words and stage directions ("um", "you know",
   "[crosstalk]"). Synthesize meaning; do not quote raw lines.

2. **summary** is plain text. NO markdown, NO bullet points, NO bold,
   NO headings, NO line breaks. 2-3 sentences. If you are tempted to
   write a list, write a sentence instead.

3. **people** lists real, recurring human participants only. In a meeting
   transcript that means the actual attendees — usually 2-6 names, never
   one entry per speaker line. Dedupe spelling variants. If the
   \`participants\` field is given in the user message, prefer those exact
   spellings. Do not include the user themselves unless they are clearly
   named. Do not include companies or bots.

4. **actionItems**, **decisions**, **insights**, **openQuestions**:
   - Each entry is ONE short sentence (≤ 120 chars). No timestamps,
     no speaker names embedded inline ("Marcel says he will..." → just
     "Send the slide deck to Anna by Friday").
   - Use imperative voice for actionItems ("Send …", "Schedule …").
   - Use declarative for decisions ("We will ship v2 in March.").
   - openQuestions are genuinely unresolved topics raised in the doc,
     not rhetorical or socratic phrases the speaker used. If nothing
     qualifies, return [].

5. **tags** are CONTENT tags, not meta-tags. FORBIDDEN values include:
   meeting, transcript, conversation, voice-note, reflection, internal,
   private, sensitive, action-items, decisions, insights, open-questions,
   summary, notes, audio, document. The sourceType and confidentiality
   the user gave you cover all of that. Tags should describe the SUBJECT
   ("it-ot-convergence", "pricing-model", "embeddings", "hiring"). Max 5
   tags. Lowercase, hyphen-separated.

6. **Be honest about emptiness.** If the document has no clear decisions,
   no clear actions, no real open questions — return []. Do not invent.

7. Use the **same language** as the input text for free-form fields
   (title, summary, item bodies). Tags stay lowercase ASCII.

# Source-type-aware behavior

The user message includes a \`sourceType\` field. Use it to disambiguate
who is talking. Treat the input \`participants\` field (a free-form
string of comma-separated names) as ground truth when it is non-empty:
emit exactly those names as \`people\`, do not add or subtract.

When \`participants\` is empty, infer the mode from the text:

- **Attributed transcript** (sourceType: meeting; or text contains
  speaker headers like "Marcel Bender:", "Speaker 1:", or
  "[hh:mm:ss]" timecodes): the speakers are the participants. Dedupe
  variants of the same name. Action items keep their owner only when
  the speaker is unambiguous in the source; otherwise emit ownerless
  imperative ("Send the deck by Friday").

- **Voice-note monologue** (sourceType: voice_note or reflection; no
  speaker headers; first-person voice dominant — "ich", "I",
  frequent "ich denke", "mir ist aufgefallen", no back-and-forth
  dialogue): the document captures ONE person thinking out loud.
  Names that appear are *mentions*, not participants. Set \`people\`
  to those mentioned names only if they clearly play a role in the
  topic (e.g. "Anna will den Pricing-Slide bis Freitag"). Do NOT add
  the speaker themselves to \`people\`. Action items use bare
  imperative voice and never start with "Marcel says he will…".

- **Voice-note multi-person, unattributed** (sourceType: voice_note
  or conversation; dialogue patterns visible — short back-and-forth
  turns, "ja genau", "aber das geht doch nicht" — but no speaker
  labels): treat as a conversation whose attendees are inferable
  only from names spoken in the room. Use those names as \`people\`.
  Do NOT invent speaker attribution for action items or decisions;
  emit them collectively ("We decided to…", "Action: …").

If you cannot tell, prefer the monologue interpretation and emit
fewer \`people\` rather than guessing.

Return ONLY the JSON.`
}

export function extractionUserPrompt(input: CaptureInput) {
  return JSON.stringify({
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
