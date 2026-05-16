import { describe, expect, it } from 'vitest'
import { generateKey, hashSecret, parseKeyString, verifySecret } from '../../server/utils/api-keys'

describe('api-keys util', () => {
  it('generates a parseable plaintext key', async () => {
    const { plaintext, prefix, hashedKey } = await generateKey()
    expect(plaintext).toMatch(/^bkos_[0-9a-f]{8}_[A-Za-z0-9_-]+$/)
    expect(prefix).toHaveLength(8)
    expect(hashedKey.startsWith('scrypt$')).toBe(true)
    const parsed = parseKeyString(plaintext)
    expect(parsed?.prefix).toBe(prefix)
  })

  it('round-trips through hash + verify', async () => {
    const secret = 'top-secret'
    const hash = await hashSecret(secret)
    expect(await verifySecret('top-secret', hash)).toBe(true)
    expect(await verifySecret('wrong', hash)).toBe(false)
  })

  it('rejects malformed key strings', () => {
    expect(parseKeyString('not-a-key')).toBeNull()
    expect(parseKeyString('bkos_short_secret')).toBeNull()
    expect(parseKeyString('bkos_12345678_')).toBeNull()
  })
})
