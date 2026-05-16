import { getMethod } from 'h3'
import { loggerFor } from '../utils/logger'

/**
 * Bind a child pino logger to every request and emit a single completion
 * log line with method/status/duration. Sits after the security headers
 * and CSRF middleware so we don't log preflight rejections separately.
 */
export default defineEventHandler((event) => {
  const log = loggerFor(event)
  const started = performance.now()
  event.node.res.on('finish', () => {
    log.info(
      {
        method: getMethod(event),
        status: event.node.res.statusCode,
        duration_ms: Math.round(performance.now() - started)
      },
      'request'
    )
  })
})
