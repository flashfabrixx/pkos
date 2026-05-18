import { createHmac } from 'node:crypto'
import { query } from './db'
import { logger } from './logger'

const MAX_ATTEMPTS = 5
const BASE_DELAY_MS = 60_000 // 1 min, doubled per retry
const TIMEOUT_MS = 8_000

interface DeliveryRow {
  id: string
  subscription_id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
  url: string
  secret: string
}

/**
 * Drain all pending webhook_deliveries whose next_attempt_at has
 * arrived. Each delivery is HMAC-signed and POSTed with a short
 * timeout. Failures bump `attempts` and schedule an exponential
 * backoff; after MAX_ATTEMPTS the row is left marked failed and the
 * subscription is deactivated so we stop spamming a broken endpoint.
 */
export async function drainWebhookQueue(): Promise<{ delivered: number, failed: number, deactivated: number }> {
  const stats = { delivered: 0, failed: 0, deactivated: 0 }
  const due = await query<DeliveryRow>(
    `SELECT d.id, d.subscription_id, d.event_type, d.payload, d.attempts,
            s.url, s.secret
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
      WHERE d.delivered_at IS NULL
        AND d.next_attempt_at <= now()
        AND s.active = true
      ORDER BY d.next_attempt_at ASC
      LIMIT 50`
  )

  for (const row of due.rows) {
    const body = JSON.stringify(row.payload)
    const signature = createHmac('sha256', row.secret).update(body).digest('hex')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(row.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pkos-event': row.event_type,
          'x-pkos-signature': `sha256=${signature}`
        },
        body,
        signal: controller.signal
      })
      const ok = response.status >= 200 && response.status < 300
      if (ok) {
        await query(
          `UPDATE webhook_deliveries SET delivered_at = now(), status_code = $2, attempts = attempts + 1, error = NULL WHERE id = $1`,
          [row.id, response.status]
        )
        await query(`UPDATE webhook_subscriptions SET last_status = $2, last_delivered_at = now() WHERE id = $1`, [row.subscription_id, response.status])
        stats.delivered++
      } else {
        await scheduleRetry(row, response.status, `HTTP ${response.status}`, stats)
      }
    } catch (error) {
      await scheduleRetry(row, null, (error as Error).message, stats)
    } finally {
      clearTimeout(timer)
    }
  }
  if (stats.delivered + stats.failed + stats.deactivated > 0) {
    logger.info({ component: 'webhook', ...stats }, 'webhook drain cycle')
  }
  return stats
}

async function scheduleRetry(row: DeliveryRow, statusCode: number | null, error: string, stats: { failed: number, deactivated: number }) {
  const nextAttempts = row.attempts + 1
  if (nextAttempts >= MAX_ATTEMPTS) {
    await query(
      `UPDATE webhook_deliveries SET status_code = $2, error = $3, attempts = $4 WHERE id = $1`,
      [row.id, statusCode, error, nextAttempts]
    )
    await query(`UPDATE webhook_subscriptions SET active = false, last_status = $2 WHERE id = $1`, [row.subscription_id, statusCode])
    stats.deactivated++
  } else {
    const delay = BASE_DELAY_MS * Math.pow(2, nextAttempts - 1)
    await query(
      `UPDATE webhook_deliveries SET status_code = $2, error = $3, attempts = $4,
              next_attempt_at = now() + ($5::int * INTERVAL '1 millisecond')
       WHERE id = $1`,
      [row.id, statusCode, error, nextAttempts, delay]
    )
    stats.failed++
  }
}
