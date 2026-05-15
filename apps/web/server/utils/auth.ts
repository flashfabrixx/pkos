import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, getCookie, setCookie, type H3Event } from 'h3'

const cookieName = 'bkos_session'
const maxAgeSeconds = 60 * 60 * 24 * 14

export function createSession(username: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  })).toString('base64url')
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
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u: string, exp: number }
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return data.u
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
