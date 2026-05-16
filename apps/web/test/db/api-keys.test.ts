import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashSecret, verifySecret } from '../../server/utils/api-keys'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('api_keys table (migration 0014)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('persists hashed_key and looks up by prefix', async () => {
    await withTx(ctx, async (client) => {
      const hashed = await hashSecret('s3cr3t')
      await client.query(
        `INSERT INTO api_keys (name, prefix, hashed_key, actor) VALUES ($1, $2, $3, $4)`,
        ['Shortcuts', 'aabbccdd', hashed, 'marcel']
      )
      const r = await client.query<{ hashed_key: string }>(
        `SELECT hashed_key FROM api_keys WHERE prefix = 'aabbccdd' AND revoked_at IS NULL`
      )
      expect(r.rows[0]?.hashed_key).toBe(hashed)
      expect(await verifySecret('s3cr3t', r.rows[0]!.hashed_key)).toBe(true)
    })
  })

  it('soft-revokes by setting revoked_at', async () => {
    await withTx(ctx, async (client) => {
      const hashed = await hashSecret('x')
      const ins = await client.query<{ id: string }>(
        `INSERT INTO api_keys (name, prefix, hashed_key, actor) VALUES ($1, $2, $3, $4) RETURNING id`,
        ['t', '11223344', hashed, 'marcel']
      )
      await client.query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1`, [ins.rows[0]!.id])
      const r = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM api_keys WHERE prefix = '11223344' AND revoked_at IS NULL`
      )
      expect(r.rows[0]?.count).toBe('0')
    })
  })
})
