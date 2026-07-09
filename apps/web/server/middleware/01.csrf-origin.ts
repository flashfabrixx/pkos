import { createError, getMethod, getRequestHeader } from 'h3'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defense via Origin/Referer matching. SameSite=Lax already blocks the
 * common cross-site form-POST case in modern browsers, but this gives a
 * second layer: a state-changing request must come from the same origin as
 * the server. We don't require CSRF tokens because we have no cross-origin
 * legitimate clients and session cookies are SameSite=Lax + HttpOnly.
 */
export default defineEventHandler((event) => {
  const method = getMethod(event)
  if (SAFE_METHODS.has(method)) return

  // Bearer-authenticated requests (API keys used by server-to-server
  // clients like curl or n8n) carry no Origin/Referer and don't ride on
  // the session cookie. A browser can't attach an Authorization header
  // cross-site without a CORS preflight we never approve, so CSRF does
  // not apply — the key itself is verified downstream in auth.ts.
  const authorization = getRequestHeader(event, 'authorization') || ''
  if (authorization.startsWith('Bearer ')) return

  // Auth + 2FA login endpoints must work for fresh first-time browser visits
  // where the Origin matches host anyway — we still verify it.
  const host = getRequestHeader(event, 'host') || ''
  const origin = getRequestHeader(event, 'origin') || ''
  const referer = getRequestHeader(event, 'referer') || ''
  const xfp = getRequestHeader(event, 'x-forwarded-proto') || ''

  if (!host) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Host header' })
  }

  const expected = [`http://${host}`, `https://${host}`]
  // Allow a reverse-proxy upstream like nginx that forwards Host.
  if (xfp) expected.push(`${xfp}://${host}`)

  if (origin) {
    if (!expected.some((url) => origin === url)) {
      throw createError({ statusCode: 403, statusMessage: 'Origin not allowed' })
    }
    return
  }

  // Some legitimate clients (older browsers, some fetch policies) omit Origin
  // and only send Referer.
  if (referer) {
    if (!expected.some((url) => referer.startsWith(url + '/') || referer === url)) {
      throw createError({ statusCode: 403, statusMessage: 'Referer not allowed' })
    }
    return
  }

  // No Origin and no Referer: reject for state-changing requests.
  throw createError({ statusCode: 403, statusMessage: 'Missing Origin and Referer' })
})
