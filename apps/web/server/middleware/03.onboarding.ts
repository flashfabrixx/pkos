import { getMethod, getRequestURL, sendRedirect } from 'h3'
import { isSetupComplete } from '../utils/setup-state'

const ALLOW_PATH_PREFIXES = [
  '/setup',
  '/login',
  '/_nuxt',
  '/_ipx',
  '/api/setup',
  '/api/auth',
  '/api/healthz',
  '/api/readyz',
  '/__nuxt',
  '/favicon'
]

/**
 * Before the setup wizard is done, every non-API browser request that
 * isn't already on /setup gets redirected there. API routes return
 * 503-equivalent JSON so programmatic clients can detect the state
 * without HTML scraping.
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  if (ALLOW_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  if (await isSetupComplete()) return

  if (getMethod(event) === 'GET' && !path.startsWith('/api/')) {
    return sendRedirect(event, '/setup', 302)
  }
})
