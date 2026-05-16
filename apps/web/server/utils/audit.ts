import type pg from 'pg'
import { getRequestIP, type H3Event } from 'h3'
import { query as topLevelQuery } from './db'
import { logger } from './logger'

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.2fa.enroll'
  | 'auth.2fa.disable'
  | 'api_key.create'
  | 'api_key.revoke'
  | 'capture.delete'
  | 'capture.reprocess'
  | 'capture.restore'
  | 'capture.purge'
  | 'entity.delete'
  | 'entity.merge'
  | 'webhook.subscribe'
  | 'webhook.unsubscribe'

interface RecordAuditOptions {
  actor: string | null
  action: AuditAction
  resourceKind?: string
  resourceId?: string | null
  meta?: Record<string, unknown>
  ip?: string | null
  client?: pg.PoolClient
  event?: H3Event
}

/**
 * Append an audit event. Best-effort: failures are logged and swallowed
 * because we never want a failed audit insert to mask the user-facing
 * operation that just succeeded.
 */
export async function recordAudit(options: RecordAuditOptions): Promise<void> {
  const ip = options.ip ?? (options.event ? getRequestIP(options.event, { xForwardedFor: true }) ?? null : null)
  const run = options.client
    ? (sql: string, params: unknown[]) => options.client!.query(sql, params)
    : (sql: string, params: unknown[]) => topLevelQuery(sql, params)
  try {
    await run(
      `INSERT INTO audit_events (actor, action, resource_kind, resource_id, meta, ip)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        options.actor,
        options.action,
        options.resourceKind ?? null,
        options.resourceId ?? null,
        JSON.stringify(options.meta || {}),
        ip
      ]
    )
  } catch (error) {
    logger.warn({ component: 'audit', err: (error as Error).message, action: options.action }, 'audit insert failed')
  }
}
