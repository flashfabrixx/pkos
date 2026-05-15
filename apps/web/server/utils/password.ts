import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 }

function scryptAsync(password: string | Buffer, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err)
      else resolve(derived)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS)
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts as [string, string, string, string, string, string]
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!N || !r || !p) return false

  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const derived = await scryptAsync(password, salt, expected.length, { N, r, p })

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export function isHashed(value: string): boolean {
  return value.startsWith('scrypt$')
}
