import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, getCookie, setCookie, type H3Event } from 'h3'
import { query } from './db'

const cookieName = 'bkos_session'
const maxAgeSeconds = 60 * 60 * 24 * 14

interface SessionPayload {
  u: string
  iat: number
  exp: number
}

// Module-scoped revocation checkpoint. Tokens with iat < minIatSeconds are
// rejected. Populated on Nitro startup (server/plugins/security-boot-check.ts)
// and updated on logout. Cheap, sync-readable, no per-request DB hit.
let minIatSeconds = 0

export function getMinIatSeconds() {
  return minIatSeconds
}

export function setMinIatSecondsFromDb(seconds: number) {
  minIatSeconds = seconds
}

export async function revokeAllSessions(): Promise<void> {
  await query(`UPDATE auth_config SET session_min_iat = now(), updated_at = now() WHERE id = 1`)
  minIatSeconds = Math.floor(Date.now() / 1000)
}

export function createSession(username: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    u: username,
    iat: now,
    exp: now + maxAgeSeconds
  } satisfies SessionPayload)).toString('base64url')
  const signature = sign(payload, secret)
  return `${payload}.${signature}`
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds
  })
}

export function clearSessionCookie(event: H3Event) {
  setCookie(event, cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  })
}

export function getSessionUser(event: H3Event) {
  const config = useRuntimeConfig()
  const token = getCookie(event, cookieName)
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload, config.sessionSecret))) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionPayload>
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    if ((data.iat || 0) < minIatSeconds) return null
    return data.u || null
  } catch {
    return null
  }
}

export function requireAuth(event: H3Event) {
  const user = getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return user
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
