import { query } from './db'
import { logger } from './logger'

export type WebhookEventType =
  | 'capture.created'
  | 'capture.processed'
  | 'action.created'
  | 'action.completed'
  | 'entity.merged'

export const ALL_EVENT_TYPES: WebhookEventType[] = [
  'capture.created',
  'capture.processed',
  'action.created',
  'action.completed',
  'entity.merged'
]

/**
 * Emit an event for outbound webhook delivery. The function does not
 * wait for the actual HTTP POST — it enqueues a `webhook_deliveries`
 * row per active subscription that has opted in to this event type;
 * the `webhook:retry` scheduled task drains the queue.
 *
 * Failures here are logged and swallowed because the calling endpoint
 * must not appear to fail just because the bus is having a bad day.
 */
export async function emitEvent(type: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
  try {
    await query(
      `INSERT INTO webhook_deliveries (subscription_id, event_type, payload)
       SELECT id, $1, $2::jsonb
         FROM webhook_subscriptions
        WHERE active = true
          AND ($1 = ANY(events) OR events = ARRAY[]::TEXT[])`,
      [type, JSON.stringify({ event: type, occurred_at: new Date().toISOString(), data: payload })]
    )
  } catch (error) {
    logger.warn({ component: 'webhook', event: type, err: (error as Error).message }, 'event enqueue failed')
  }
}
