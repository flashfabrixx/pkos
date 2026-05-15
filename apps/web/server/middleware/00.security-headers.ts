import { getRequestHeader, setResponseHeader } from 'h3'

const STATIC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()'
}

const PROD_ONLY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
}

/**
 * Content-Security-Policy. Kept loose enough to allow Nuxt's inline runtime
 * config injection (script-src 'self' 'unsafe-inline') but tight enough to
 * block third-party origins.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

export default defineEventHandler((event) => {
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    setResponseHeader(event, name, value)
  }
  setResponseHeader(event, 'Content-Security-Policy', CSP)

  const accept = getRequestHeader(event, 'accept') || ''
  if (accept.includes('text/html') || event.path?.startsWith('/_nuxt') === false) {
    // Don't cache HTML responses by intermediaries that might serve another user.
    setResponseHeader(event, 'Cache-Control', 'no-store')
  }

  if (process.env.NODE_ENV === 'production') {
    for (const [name, value] of Object.entries(PROD_ONLY_HEADERS)) {
      setResponseHeader(event, name, value)
    }
  }
})
