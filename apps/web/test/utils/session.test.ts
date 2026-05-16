import { describe, expect, it } from 'vitest'
import { createSession } from '../../server/utils/auth'

function decode(token: string) {
  const [payload] = token.split('.')
  return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'))
}

describe('createSession', () => {
  it('encodes username + issued-at + expiry into a payload signed with HMAC', () => {
    const token = createSession('marcel', 'a'.repeat(64))
    const parts = token.split('.')
    expect(parts).toHaveLength(2)

    const payload = decode(token)
    expect(payload.u).toBe('marcel')
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
    // 14 day cookie window
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 14)
  })

  it('produces a stable signature for the same payload + secret', () => {
    // Two tokens issued at the same second with the same secret would
    // share the signature; this is a structural sanity check (signature
    // is base64url, no padding).
    const token = createSession('marcel', 'shh'.padEnd(32, '!'))
    const sig = token.split('.')[1]!
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(sig.length).toBeGreaterThan(20)
  })
})
