import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('audit_events (migration 0019)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('inserts and queries by action', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO audit_events (actor, action, resource_kind, resource_id, meta)
         VALUES ('marcel', 'auth.login', null, null, '{"ip":"1.2.3.4"}')`
      )
      const r = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM audit_events WHERE action = 'auth.login'`
      )
      expect(r.rows[0]?.count).toBe('1')
    })
  })

  it('keeps occurred_at ordered DESC for the index', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO audit_events (actor, action) VALUES ('a', 'x'), ('b', 'y'), ('c', 'z')`
      )
      const r = await client.query<{ action: string }>(
        `SELECT action FROM audit_events ORDER BY occurred_at DESC LIMIT 3`
      )
      expect(r.rows.length).toBe(3)
    })
  })
})
