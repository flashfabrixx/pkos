import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('webhook tables (migration 0020)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('enqueues a delivery per active subscription that matches the event', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO webhook_subscriptions (url, secret, events, active, created_by)
         VALUES
           ('https://a.example/hook', 's1', ARRAY['capture.created'], true, 'marcel'),
           ('https://b.example/hook', 's2', ARRAY['action.completed'], true, 'marcel'),
           ('https://c.example/hook', 's3', ARRAY[]::text[], true, 'marcel')`
      )
      await client.query(
        `INSERT INTO webhook_deliveries (subscription_id, event_type, payload)
         SELECT id, 'capture.created', '{"x":1}'::jsonb
           FROM webhook_subscriptions
          WHERE active = true
            AND ('capture.created' = ANY(events) OR events = ARRAY[]::TEXT[])`
      )
      const r = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM webhook_deliveries`)
      // Subscriber a matches by event, c matches by "all events". b doesn't.
      expect(r.rows[0]?.count).toBe('2')
    })
  })
})
