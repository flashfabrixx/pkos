import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Derive a stable 32-byte key from the session secret so secrets at rest in
// the database stay encrypted even if the DB is exfiltrated separately.
function keyFromSecret(sessionSecret: string): Buffer {
  return createHash('sha256').update(`pkos-vault:${sessionSecret}`).digest()
}

export function encryptSecret(plain: string, sessionSecret: string): string {
  const key = keyFromSecret(sessionSecret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `vault1$${iv.toString('base64')}$${tag.toString('base64')}$${ciphertext.toString('base64')}`
}

export function decryptSecret(payload: string, sessionSecret: string): string {
  const parts = payload.split('$')
  if (parts.length !== 4 || parts[0] !== 'vault1') {
    throw new Error('Invalid vault payload')
  }
  const iv = Buffer.from(parts[1]!, 'base64')
  const tag = Buffer.from(parts[2]!, 'base64')
  const ciphertext = Buffer.from(parts[3]!, 'base64')
  const key = keyFromSecret(sessionSecret)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
}
