import type { CaptureInput, ExtractedKnowledge } from '@bkos/core'

const ACTION_RE = /\b(action|todo|follow[- ]?up|nächster schritt|naechster schritt|muss|müssen|muessen|bitte|ich werde|wir werden|should|need to)\b/i
const DECISION_RE = /\b(decision|decided|entscheidung|entschieden|beschlossen|wir machen|wir nehmen|festgelegt)\b/i
const INSIGHT_RE = /\b(insight|learning|erkenntnis|wichtig|auffällig|auffaellig|bemerkenswert|klar geworden)\b/i
const QUESTION_RE = /\?$|\b(offene frage|unklar|klären|klaeren|wie gehen wir|was ist mit|question)\b/i

export function extractKnowledge(input: CaptureInput): ExtractedKnowledge {
  const sentences = splitSentences(expandInlineLabels(input.rawText))
  const lines = input.rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const labeled = extractLabeledItems(input.rawText)
  const participants = splitList(input.participants)
  const project = input.project?.trim()

  const actionItems = labeled.actions.length ? labeled.actions.slice(0, 8) : pickLines(lines, ACTION_RE, 8)
  const decisions = labeled.decisions.length ? labeled.decisions.slice(0, 6) : pickLines(lines, DECISION_RE, 6)
  const insights = labeled.insights.length ? labeled.insights.slice(0, 6) : pickLines(lines, INSIGHT_RE, 6)
  const openQuestions = labeled.questions.length ? labeled.questions.slice(0, 6) : pickLines(lines, QUESTION_RE, 6)
  const inferredPeople = inferPeople(stripLabeledSegments(input.rawText))
  const people = unique([...participants, ...inferredPeople]).slice(0, 12)
  const projects = unique([...(project ? [project] : []), ...inferProjects(input.rawText)]).slice(0, 8)
  const tags = buildTags(input, projects, actionItems, decisions)

  return {
    summary: summarize(sentences, input.rawText),
    people,
    projects,
    actionItems: actionItems.length ? actionItems : fallbackActionItems(sentences),
    decisions,
    insights: insights.length ? insights : fallbackInsights(sentences),
    openQuestions,
    tags
  }
}

export interface CaptureMetadataInput {
  title?: string
  rawText: string
  participants?: string
  project?: string
  sourceType?: string
}

export interface DerivedCaptureMetadata {
  title: string
  participants: string
  project: string
}

export function deriveCaptureMetadata(input: CaptureMetadataInput): DerivedCaptureMetadata {
  const stripped = stripLabeledSegments(input.rawText)
  const inferredPeople = inferPeople(stripped).join(', ')
  const inferredProject = inferProjects(input.rawText)[0] || ''

  return {
    title: normalizeTitle(input.title) || deriveTitle(input.rawText, input.sourceType),
    participants: input.participants?.trim() || inferredPeople,
    project: input.project?.trim() || inferredProject
  }
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function expandInlineLabels(text: string): string {
  return text.replace(/\b(Decision|Action|Insight|Open question|Entscheidung|Aktion|Erkenntnis|Offene Frage)\s*:/gi, '\n$1:')
}

function extractLabeledItems(text: string) {
  const normalized = expandInlineLabels(text)
  const items = { actions: [] as string[], decisions: [] as string[], insights: [] as string[], questions: [] as string[] }

  for (const line of normalized.split(/\r?\n/).map((part) => part.trim()).filter(Boolean)) {
    const match = line.match(/^(Decision|Entscheidung|Action|Aktion|Insight|Erkenntnis|Open question|Offene Frage)\s*:\s*(.+)$/i)
    if (!match) continue
    const label = (match[1] || '').toLowerCase()
    const value = cleanBullet(match[2] || '')
    if (!value) continue
    if (label === 'decision' || label === 'entscheidung') items.decisions.push(value)
    if (label === 'action' || label === 'aktion') items.actions.push(value)
    if (label === 'insight' || label === 'erkenntnis') items.insights.push(value)
    if (label === 'open question' || label === 'offene frage') items.questions.push(value)
  }

  return items
}

function stripLabeledSegments(text: string): string {
  return expandInlineLabels(text)
    .split(/\r?\n/)
    .filter((line) => !/^(Decision|Entscheidung|Action|Aktion|Insight|Erkenntnis|Open question|Offene Frage)\s*:/i.test(line.trim()))
    .join('\n')
}

function summarize(sentences: string[], rawText: string): string {
  const meaningful = sentences.filter((sentence) => sentence.length > 25)
  const picked = meaningful.slice(0, 3).join(' ')
  if (picked) return trimTo(picked, 520)
  return trimTo(rawText.replace(/\s+/g, ' '), 520) || 'No summary available yet.'
}

function normalizeTitle(value?: string) {
  return trimTo((value || '').replace(/\s+/g, ' '), 180)
}

function deriveTitle(text: string, sourceType?: string) {
  const explicit = text.match(/^\s*(?:Title|Titel)\s*:\s*(.+)$/im)?.[1]
  if (explicit) return trimTo(explicit, 90)

  const heading = text.match(/^\s*#\s+(.+)$/m)?.[1]
  if (heading) return trimTo(heading, 90)

  const project = inferProjects(text)[0]
  if (project) return trimTo(`${project} ${labelForSource(sourceType)}`, 90)

  const firstSentence = splitSentences(text)[0]
  if (firstSentence) return trimTo(firstSentence, 90)

  return `${labelForSource(sourceType)} ${new Date().toISOString().slice(0, 10)}`
}

function labelForSource(sourceType?: string) {
  if (sourceType === 'meeting') return 'Meeting'
  if (sourceType === 'voice_note') return 'Voice Note'
  if (sourceType === 'conversation') return 'Conversation'
  if (sourceType === 'reflection') return 'Reflection'
  return 'Business Note'
}

function pickLines(lines: string[], pattern: RegExp, limit: number): string[] {
  return unique(lines.filter((line) => pattern.test(line)).map(cleanBullet)).slice(0, limit)
}

function fallbackActionItems(sentences: string[]): string[] {
  return sentences
    .filter((sentence) => /\b(next|nächste|naechste|todo|machen|prüfen|pruefen)\b/i.test(sentence))
    .map(cleanBullet)
    .slice(0, 3)
}

function fallbackInsights(sentences: string[]): string[] {
  return sentences
    .filter((sentence) => sentence.length > 60)
    .map(cleanBullet)
    .slice(0, 3)
}

function splitList(value?: string): string[] {
  if (!value) return []
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)
}

function inferPeople(text: string): string[] {
  const matches = text.match(/\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2}\b/g) || []
  const stop = new Set(['Action Items', 'Next Steps', 'Open Questions', 'Business Knowledge', 'Microsoft Teams'])
  return unique(matches.filter((name) => !stop.has(name) && !/^(Project|Projekt|Initiative|Programm)\s+/i.test(name))).slice(0, 8)
}

function inferProjects(text: string): string[] {
  const matches = text.match(/\b(?:Projekt|Project|Initiative|Programm)\s+["“]?([A-ZÄÖÜ][\wÄÖÜäöüß -]{2,60})["”]?/g) || []
  return unique(matches.map((match) => match.replace(/^(Projekt|Project|Initiative|Programm)\s+/i, '').trim()))
}

function buildTags(input: CaptureInput, projects: string[], actionItems: string[], decisions: string[]): string[] {
  const base = [input.sourceType, input.confidentiality]
  const projectTags = projects.map(slugify)
  const derived = [
    actionItems.length ? 'action-items' : '',
    decisions.length ? 'decisions' : ''
  ]
  return unique([...base, ...projectTags, ...derived].filter(Boolean)).slice(0, 10)
}

function cleanBullet(value: string): string {
  return value.replace(/^[-*•\s]+/, '').replace(/^\[[ x]\]\s*/i, '').trim()
}

function trimTo(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value.trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
