import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const PRE_AUTH_LIFETIME_SECONDS = 5 * 60

export function createPreAuthToken(username: string, sessionSecret: string): string {
  const nonce = randomBytes(8).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    u: username,
    n: nonce,
    exp: Math.floor(Date.now() / 1000) + PRE_AUTH_LIFETIME_SECONDS,
    k: 'pre-auth'
  })).toString('base64url')
  const sig = sign(payload, sessionSecret)
  return `${payload}.${sig}`
}

export function verifyPreAuthToken(token: string, sessionSecret: string): { username: string } | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload, sessionSecret)
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (data.k !== 'pre-auth') return null
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return { username: data.u }
  } catch {
    return null
  }
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', `${secret}:pre-auth`).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
