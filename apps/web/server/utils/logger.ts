import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import pino, { type Logger } from 'pino'

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

// Pretty output in dev so logs stay readable in `pnpm dev`. Production logs
// stay JSON so they ship cleanly to journald, Loki, Cloudwatch, etc.
export const logger: Logger = pino({
  level,
  base: { service: 'bkos-web' },
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } } }
    : {})
})

/**
 * Per-request child logger bound to a stable request id. The id is read
 * from the standard `x-request-id` header if present (so a reverse-proxy
 * can correlate request logs across layers) and otherwise generated.
 */
export function loggerFor(event: H3Event): Logger {
  const existing = (event.context as { logger?: Logger }).logger
  if (existing) return existing
  const requestId =
    (event.node.req.headers['x-request-id'] as string | undefined) || randomUUID()
  const child = logger.child({ req_id: requestId, path: event.path })
  ;(event.context as { logger?: Logger }).logger = child
  ;(event.context as { req_id?: string }).req_id = requestId
  // Echo the id back so downstream tooling can pick it up.
  event.node.res.setHeader('x-request-id', requestId)
  return child
}
