import { describe, expect, it } from 'vitest'
import { hashPassword, isHashed, verifyPassword } from '../../server/utils/password'

describe('password util', () => {
  it('produces a scrypt-formatted hash that round-trips', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(isHashed(hash)).toBe(true)
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('rejects plaintext as hashed', () => {
    expect(isHashed('plaintext-password')).toBe(false)
  })

  it('returns false rather than throwing on malformed hash', async () => {
    expect(await verifyPassword('whatever', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('whatever', 'scrypt$incomplete')).toBe(false)
  })
})
