import { describe, expect, it } from 'vitest'
import { extractionSystemPrompt, extractionUserPrompt } from '../../server/utils/extractor'

describe('extractionSystemPrompt', () => {
  const prompt = extractionSystemPrompt()

  it('declares the JSON contract with all required fields', () => {
    for (const field of [
      'title', 'summary', 'people', 'projects',
      'actionItems', 'decisions', 'insights', 'openQuestions', 'tags'
    ]) {
      expect(prompt, `mentions ${field}`).toMatch(new RegExp(`"${field}"`))
    }
  })

  it('forbids markdown formatting in the summary', () => {
    expect(prompt).toMatch(/NO markdown/i)
    expect(prompt).toMatch(/plain text/i)
  })

  it('tells the model to strip transcript artifacts', () => {
    expect(prompt).toMatch(/timestamps?/i)
    expect(prompt).toMatch(/speaker (header|names)/i)
  })

  it('tells the model to dedupe speaker lines into real participants', () => {
    expect(prompt).toMatch(/real, recurring human participants/i)
  })

  it('forbids meta-tags that duplicate existing PKOS taxonomy', () => {
    // The model must not emit any of these as content tags - they are
    // already covered by sourceType / confidentiality / etc.
    for (const banned of ['meeting', 'transcript', 'internal', 'private',
                          'action-items', 'decisions', 'insights']) {
      expect(prompt, `forbids ${banned}`).toMatch(new RegExp(banned))
    }
  })

  it('caps action / decision / insight entries at one short sentence', () => {
    expect(prompt).toMatch(/120 chars|short sentence/i)
  })

  it('tells the model to return [] rather than invent', () => {
    expect(prompt).toMatch(/Do not invent|return \[\]/i)
  })

  it('treats a non-empty participants input as ground truth for people', () => {
    expect(prompt).toMatch(/participants[\s\S]*ground truth/i)
  })

  it('teaches the three voice-note modes (attributed / monologue / multi-person)', () => {
    expect(prompt).toMatch(/Attributed transcript/i)
    expect(prompt).toMatch(/Voice-note monologue/i)
    expect(prompt).toMatch(/Voice-note multi-person/i)
  })

  it('forbids fabricated speaker attribution in unattributed voice notes', () => {
    expect(prompt).toMatch(/do not invent speaker attribution/i)
  })

  it('prefers the monologue interpretation under uncertainty', () => {
    expect(prompt).toMatch(/prefer the monologue interpretation/i)
  })
})

describe('extractionUserPrompt', () => {
  const input = {
    title: 'PreAlignment IT OT Workshop Part 2',
    sourceType: 'meeting' as const,
    rawText: '[00:00:00] Marcel Bender: hi everyone\n[00:00:05] Anna Mueller: ready to go',
    participants: 'Marcel Bender, Anna Mueller',
    project: 'IT/OT Alignment',
    capturedAt: '2026-05-18',
    confidentiality: 'internal' as const
  }
  const user = extractionUserPrompt(input)
  const parsed = JSON.parse(user) as Record<string, unknown>

  it('does not seed the model with the user-provided title (so it derives a fresh one)', () => {
    expect(parsed.title).toBeUndefined()
  })

  it('carries participants verbatim so spellings are preserved', () => {
    expect(parsed.participants).toBe('Marcel Bender, Anna Mueller')
  })

  it('passes rawText through unchanged', () => {
    expect(parsed.rawText).toBe(input.rawText)
  })
})
