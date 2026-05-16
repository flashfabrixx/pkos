import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('departments (migration 0021)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('accepts the new department entity type', async () => {
    await withTx(ctx, async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('department', 'Engineering', 'engineering') RETURNING id`
      )
      expect(r.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  it('supports parent_id self-reference and membership rows', async () => {
    await withTx(ctx, async (client) => {
      const parent = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('department', 'Org', 'org') RETURNING id`
      )
      const child = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name, parent_id) VALUES ('department', 'Sub', 'sub', $1) RETURNING id`,
        [parent.rows[0]!.id]
      )
      expect(child.rows[0]?.id).toBeTruthy()

      const person = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Alice', 'alice') RETURNING id`
      )
      await client.query(
        `INSERT INTO department_memberships (department_id, member_id, kind, role)
         VALUES ($1, $2, 'person', 'Lead')`,
        [child.rows[0]!.id, person.rows[0]!.id]
      )

      const count = await client.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM department_memberships WHERE department_id = $1`,
        [child.rows[0]!.id]
      )
      expect(count.rows[0]?.c).toBe('1')
    })
  })

  it('rejects an invalid membership kind', async () => {
    await withTx(ctx, async (client) => {
      const dept = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('department', 'D', 'd') RETURNING id`
      )
      const person = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'P', 'p') RETURNING id`
      )
      await expect(
        client.query(
          `INSERT INTO department_memberships (department_id, member_id, kind) VALUES ($1, $2, 'manager')`,
          [dept.rows[0]!.id, person.rows[0]!.id]
        )
      ).rejects.toThrow()
    })
  })
})
