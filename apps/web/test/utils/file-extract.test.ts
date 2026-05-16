import { describe, expect, it } from 'vitest'
import { extractText } from '../../server/utils/file-extract'

describe('extractText', () => {
  it('returns text/* buffers verbatim', async () => {
    const out = await extractText(Buffer.from('hello world'), 'text/plain', 'note.txt')
    expect(out).toBe('hello world')
  })

  it('falls back to null for unknown binary types', async () => {
    const out = await extractText(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'application/octet-stream', 'mystery.bin')
    expect(out).toBeNull()
  })

  it('parses JSON as text', async () => {
    const out = await extractText(Buffer.from('{"a":1}'), 'application/json', 'data.json')
    expect(out).toBe('{"a":1}')
  })
})
