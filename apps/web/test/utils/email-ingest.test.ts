import { describe, expect, it } from 'vitest'
import { parseAllowList } from '../../server/utils/email-ingest'

describe('parseAllowList', () => {
  it('returns empty list for undefined or empty string', () => {
    expect(parseAllowList(undefined)).toEqual([])
    expect(parseAllowList('')).toEqual([])
  })

  it('lowercases and trims entries', () => {
    expect(parseAllowList('Alice@Example.com , bob@x.io')).toEqual(['alice@example.com', 'bob@x.io'])
  })

  it('drops empty segments', () => {
    expect(parseAllowList(',a@b.com,,')).toEqual(['a@b.com'])
  })
})
