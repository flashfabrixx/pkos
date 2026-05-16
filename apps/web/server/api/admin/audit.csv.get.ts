import { setResponseHeader } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

/**
 * CSV export of audit events. Used as a download from /admin/audit; cap
 * at 10_000 rows per request — operators who want the full history
 * should use `pg_dump audit_events` instead.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const result = await query<{
    id: string
    actor: string | null
    action: string
    resource_kind: string | null
    resource_id: string | null
    meta: Record<string, unknown>
    ip: string | null
    occurred_at: string
  }>(
    `SELECT id, actor, action, resource_kind, resource_id, meta, ip, occurred_at
       FROM audit_events
       ORDER BY occurred_at DESC
       LIMIT 10000`
  )
  const rows = ['id,actor,action,resource_kind,resource_id,ip,occurred_at,meta']
  for (const r of result.rows) {
    rows.push([
      r.id,
      escape(r.actor),
      escape(r.action),
      escape(r.resource_kind),
      escape(r.resource_id),
      escape(r.ip),
      r.occurred_at,
      escape(JSON.stringify(r.meta || {}))
    ].join(','))
  }
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="audit-events.csv"')
  return rows.join('\n')
})

function escape(value: string | null | undefined): string {
  if (value == null) return ''
  const needsQuoting = /[",\n]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuoting ? `"${escaped}"` : escaped
}
