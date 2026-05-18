import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, getCookie, getRequestHeader, setCookie, type H3Event } from 'h3'
import { query } from './db'
import { parseKeyString, verifySecret, type ApiKeyScope } from './api-keys'

const cookieName = 'pkos_session'
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

export interface AuthedRequest {
  actor: string
  /** 'session' when authenticated via cookie, 'api_key' when via Bearer token. */
  via: 'session' | 'api_key'
  /** API key scopes when via='api_key'; the full set when via='session'. */
  scopes: string[]
  apiKeyId?: string
}

/**
 * Look up the API key from the Authorization: Bearer header and verify it
 * against `api_keys.hashed_key`. Returns the matched row (with actor and
 * scopes) or null. Touches `last_used_at` on a hit.
 */
export async function getApiKeyAuth(event: H3Event): Promise<AuthedRequest | null> {
  const header = getRequestHeader(event, 'authorization') || ''
  if (!header.startsWith('Bearer ')) return null
  const parsed = parseKeyString(header.slice(7).trim())
  if (!parsed) return null
  const result = await query<{ id: string, hashed_key: string, scopes: string[], actor: string }>(
    `SELECT id, hashed_key, scopes, actor FROM api_keys WHERE prefix = $1 AND revoked_at IS NULL`,
    [parsed.prefix]
  )
  const row = result.rows[0]
  if (!row) return null
  const ok = await verifySecret(parsed.secret, row.hashed_key)
  if (!ok) return null
  // Best-effort update; failure to write `last_used_at` should not block auth.
  query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => undefined)
  return { actor: row.actor, via: 'api_key', scopes: row.scopes, apiKeyId: row.id }
}

/**
 * Accept either a logged-in session cookie or a valid API key. Endpoints
 * under `/api/v1/*` should call this; UI endpoints under `/api/*` keep
 * using `requireAuth` for the cookie-only path.
 */
export async function requireAuthOrApiKey(event: H3Event, requiredScope?: ApiKeyScope): Promise<AuthedRequest> {
  const session = getSessionUser(event)
  if (session) return { actor: session, via: 'session', scopes: ['*'] }
  const apiKey = await getApiKeyAuth(event)
  if (apiKey) {
    if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes('*')) {
      throw createError({ statusCode: 403, statusMessage: `API key missing scope: ${requiredScope}` })
    }
    return apiKey
  }
  throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
