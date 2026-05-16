import { setResponseStatus } from 'h3'
import { query } from '../utils/db'
import { loggerFor } from '../utils/logger'

/**
 * Liveness probe. Returns 200 when the process can serve traffic *and*
 * the database round-trips. Intentionally lightweight — heavier checks
 * (migrations, providers, vault writability) belong in /readyz.
 */
export default defineEventHandler(async (event) => {
  const log = loggerFor(event)
  try {
    await query('SELECT 1')
    return { status: 'ok' }
  } catch (error) {
    log.warn({ err: (error as Error).message }, 'healthz: database unreachable')
    setResponseStatus(event, 503)
    return { status: 'degraded', error: 'database unreachable' }
  }
})
