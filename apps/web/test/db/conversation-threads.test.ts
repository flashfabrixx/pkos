import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

/**
 * Schema-level integration tests for migration 0022 (conversation
 * threads + messages). The streaming + LLM behaviour is covered by
 * the HTTP layer; this suite just verifies the table contract:
 *
 *   - thread defaults (title, model, timestamps)
 *   - the touch-thread trigger updates updated_at on new messages
 *   - FK cascade removes messages when a thread is hard-deleted
 *   - role check constraint refuses bogus roles
 *   - soft-delete on threads keeps messages around
 */
describe('conversation_threads + messages (migration 0022)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  }, 120_000)

  afterAll(async () => {
    await ctx?.stop()
  })

  it('creates a thread with sensible defaults', async () => {
    await withTx(ctx, async (client) => {
      const r = await client.query<{ id: string, title: string, model: string }>(
        `INSERT INTO conversation_threads DEFAULT VALUES RETURNING id, title, model`
      )
      const row = r.rows[0]!
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(row.title).toBe('New thread')
      expect(row.model).toBe('openrouter/anthropic/claude-sonnet-4-6')
    })
  })

  it('touches the parent thread when a message lands', async () => {
    await withTx(ctx, async (client) => {
      const r = await client.query<{ id: string, updated_at: string }>(
        `INSERT INTO conversation_threads (title) VALUES ('seed')
         RETURNING id, updated_at::text AS updated_at`
      )
      const { id, updated_at } = r.rows[0]!

      // Force a measurable gap so the timestamp comparison is robust.
      await new Promise((resolve) => setTimeout(resolve, 25))

      await client.query(
        `INSERT INTO conversation_messages (thread_id, role, content)
         VALUES ($1, 'user', 'hello')`,
        [id]
      )
      const after = await client.query<{ updated_at: string }>(
        `SELECT updated_at::text AS updated_at FROM conversation_threads WHERE id = $1`,
        [id]
      )
      expect(new Date(after.rows[0]!.updated_at).getTime())
        .toBeGreaterThan(new Date(updated_at).getTime())
    })
  })

  it('cascades hard-delete from thread to messages', async () => {
    await withTx(ctx, async (client) => {
      const t = await client.query<{ id: string }>(
        `INSERT INTO conversation_threads (title) VALUES ('cascade') RETURNING id`
      )
      const tid = t.rows[0]!.id
      await client.query(
        `INSERT INTO conversation_messages (thread_id, role, content)
         VALUES ($1, 'user', 'one'), ($1, 'assistant', 'two')`,
        [tid]
      )
      await client.query(`DELETE FROM conversation_threads WHERE id = $1`, [tid])
      const count = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM conversation_messages WHERE thread_id = $1`,
        [tid]
      )
      expect(count.rows[0]!.n).toBe('0')
    })
  })

  it('keeps messages on soft-delete (deleted_at set, FK still satisfied)', async () => {
    await withTx(ctx, async (client) => {
      const t = await client.query<{ id: string }>(
        `INSERT INTO conversation_threads (title) VALUES ('soft') RETURNING id`
      )
      const tid = t.rows[0]!.id
      await client.query(
        `INSERT INTO conversation_messages (thread_id, role, content)
         VALUES ($1, 'user', 'still here')`,
        [tid]
      )
      await client.query(
        `UPDATE conversation_threads SET deleted_at = now() WHERE id = $1`,
        [tid]
      )
      const messages = await client.query<{ content: string }>(
        `SELECT content FROM conversation_messages WHERE thread_id = $1`,
        [tid]
      )
      expect(messages.rows).toHaveLength(1)
      expect(messages.rows[0]!.content).toBe('still here')
    })
  })

  it('rejects unknown message roles', async () => {
    await withTx(ctx, async (client) => {
      const t = await client.query<{ id: string }>(
        `INSERT INTO conversation_threads (title) VALUES ('roles') RETURNING id`
      )
      await expect(
        client.query(
          `INSERT INTO conversation_messages (thread_id, role, content)
           VALUES ($1, 'bot', 'nope')`,
          [t.rows[0]!.id]
        )
      ).rejects.toThrow(/role/i)
    })
  })

  it('stores sources + model + provider + token counts on assistant messages', async () => {
    await withTx(ctx, async (client) => {
      const t = await client.query<{ id: string }>(
        `INSERT INTO conversation_threads (title) VALUES ('payload') RETURNING id`
      )
      const tid = t.rows[0]!.id
      await client.query(
        `INSERT INTO conversation_messages
           (thread_id, role, content, sources, model, provider, tokens_in, tokens_out)
         VALUES ($1, 'assistant', 'answer', $2::jsonb,
                 'openrouter/anthropic/claude-sonnet-4-6', 'openrouter', 1234, 567)`,
        [tid, JSON.stringify([{ documentId: 'abc', title: 'Doc', excerpt: 'snippet' }])]
      )
      const r = await client.query<{
        sources: unknown[]
        model: string
        provider: string
        tokens_in: number
        tokens_out: number
      }>(
        `SELECT sources, model, provider, tokens_in, tokens_out
         FROM conversation_messages WHERE thread_id = $1 AND role = 'assistant'`,
        [tid]
      )
      const row = r.rows[0]!
      expect(row.sources).toHaveLength(1)
      expect((row.sources[0] as { title: string }).title).toBe('Doc')
      expect(row.model).toBe('openrouter/anthropic/claude-sonnet-4-6')
      expect(row.provider).toBe('openrouter')
      expect(row.tokens_in).toBe(1234)
      expect(row.tokens_out).toBe(567)
    })
  })
})
