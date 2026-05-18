import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const PREFIX_BYTES = 4 // → 8 hex chars
const SECRET_BYTES = 24 // → 32 base64url chars
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 }

export interface GeneratedKey {
  /** What to show the user once: `pkos_<prefix>_<secret>`. */
  plaintext: string
  /** 8-hex public identifier we store and use for indexed lookup. */
  prefix: string
  /** scrypt-derived hash to persist. */
  hashedKey: string
}

function scryptAsync(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err)
      else resolve(derived)
    })
  })
}

export async function generateKey(): Promise<GeneratedKey> {
  const prefix = randomBytes(PREFIX_BYTES).toString('hex')
  const secret = randomBytes(SECRET_BYTES).toString('base64url')
  const plaintext = `pkos_${prefix}_${secret}`
  const hashedKey = await hashSecret(secret)
  return { plaintext, prefix, hashedKey }
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(secret, salt)
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts as [string, string, string, string, string, string]
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!N || !r || !p) return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, expected.length, { N, r, p }, (err, derived) => {
      if (err) reject(err)
      else resolve(derived.length === expected.length && timingSafeEqual(derived, expected))
    })
  })
}

/** Parse `pkos_<prefix>_<secret>`. Returns null for any malformed string. */
export function parseKeyString(input: string): { prefix: string, secret: string } | null {
  if (!input.startsWith('pkos_')) return null
  const rest = input.slice(5)
  const underscore = rest.indexOf('_')
  if (underscore <= 0) return null
  const prefix = rest.slice(0, underscore)
  const secret = rest.slice(underscore + 1)
  if (prefix.length !== PREFIX_BYTES * 2 || !secret) return null
  return { prefix, secret }
}

export const DEFAULT_SCOPES = ['captures:write', 'captures:read', 'entities:read'] as const
export type ApiKeyScope =
  | typeof DEFAULT_SCOPES[number]
  | 'entities:write'
  | 'search:read'
  | 'chat:read'

export const ALL_SCOPES: ApiKeyScope[] = [
  'captures:write',
  'captures:read',
  'entities:read',
  'entities:write',
  'search:read',
  'chat:read'
]
