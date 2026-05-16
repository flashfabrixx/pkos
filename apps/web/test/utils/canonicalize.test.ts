import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../server/utils/canonicalize'

describe('canonicalize', () => {
  it('lowercases and slugifies', () => {
    expect(canonicalize('Acme Corp')).toBe('acme-corp')
    expect(canonicalize('  Foo Bar  ')).toBe('foo-bar')
  })

  it('strips diacritics', () => {
    expect(canonicalize('Müller')).toBe('muller')
    expect(canonicalize('Café')).toBe('cafe')
  })

  it('collapses runs of separators', () => {
    expect(canonicalize('a   b  ___ c')).toBe('a-b-c')
  })

  it('trims leading and trailing separators', () => {
    expect(canonicalize('--abc--')).toBe('abc')
  })
})
