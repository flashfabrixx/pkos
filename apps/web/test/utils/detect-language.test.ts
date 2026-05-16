import { describe, expect, it } from 'vitest'
import { detectLanguage, isSupportedLanguageCode, pgConfigFor } from '../../server/utils/detect-language'

describe('detectLanguage', () => {
  it('returns simple/null for too-short input', () => {
    expect(detectLanguage('hi')).toEqual({ code: null, pgConfig: 'simple' })
  })

  it('detects English', () => {
    const result = detectLanguage('The quick brown fox jumps over the lazy dog repeatedly, with the cat watching.')
    expect(result.code).toBe('en')
    expect(result.pgConfig).toBe('english')
  })

  it('detects German', () => {
    const result = detectLanguage('Der schnelle braune Fuchs springt immer wieder über den faulen Hund, während die Katze zuschaut.')
    expect(result.code).toBe('de')
    expect(result.pgConfig).toBe('german')
  })
})

describe('pgConfigFor', () => {
  it('maps known codes to Postgres TSV configs', () => {
    expect(pgConfigFor('en')).toBe('english')
    expect(pgConfigFor('de')).toBe('german')
    expect(pgConfigFor('fr')).toBe('french')
  })

  it('falls through to simple for unknown or null', () => {
    expect(pgConfigFor(null)).toBe('simple')
    expect(pgConfigFor('xx')).toBe('simple')
  })
})

describe('isSupportedLanguageCode', () => {
  it('accepts known languages', () => {
    expect(isSupportedLanguageCode('en')).toBe(true)
    expect(isSupportedLanguageCode('tr')).toBe(true)
  })

  it('rejects unknown', () => {
    expect(isSupportedLanguageCode('zh')).toBe(false)
  })
})
