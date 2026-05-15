import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const DEFAULT_PERIOD = 30
const DEFAULT_DIGITS = 6
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateBase32Secret(byteLength = 20): string {
  const bytes = randomBytes(byteLength)
  return toBase32(bytes)
}

function toBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let result = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return result
}

function fromBase32(input: string): Buffer {
  const clean = input.replace(/[^A-Z2-7]/gi, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: bigint, digits = DEFAULT_DIGITS): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(counter)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  const code = (binCode % 10 ** digits).toString().padStart(digits, '0')
  return code
}

export function generateTotpCode(base32Secret: string, atSeconds = Math.floor(Date.now() / 1000)): string {
  const secret = fromBase32(base32Secret)
  const counter = BigInt(Math.floor(atSeconds / DEFAULT_PERIOD))
  return hotp(secret, counter)
}

/**
 * Verify a TOTP code with a ±1 step tolerance (handles clock drift).
 */
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const secret = fromBase32(base32Secret)
  const now = Math.floor(Date.now() / 1000)
  const counter = BigInt(Math.floor(now / DEFAULT_PERIOD))
  for (const offset of [0, -1, 1] as const) {
    const candidate = hotp(secret, counter + BigInt(offset))
    if (constantTimeEqual(candidate, code)) return true
  }
  return false
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function buildOtpauthUri(opts: { secret: string, issuer: string, account: string }): string {
  const issuer = encodeURIComponent(opts.issuer)
  const account = encodeURIComponent(opts.account)
  return `otpauth://totp/${issuer}:${account}?secret=${opts.secret}&issuer=${issuer}&algorithm=SHA1&digits=${DEFAULT_DIGITS}&period=${DEFAULT_PERIOD}`
}
