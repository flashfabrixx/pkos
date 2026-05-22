import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'
import { startNuxtServer, type NuxtServerContext } from '../setup/nuxt-server'

const SKIP = process.env.PKOS_SKIP_NUXT_INTEGRATION === '1'
const d = SKIP ? describe.skip : describe

/**
 * End-to-end flow over a real Nuxt dev server + Postgres testcontainer.
 * No LLM provider is configured in the test harness, so the chat
 * stream emits the placeholder answer in one chunk - good enough to
 * verify the wiring (SSE format, sources event, message persistence,
 * auto-title-on-first-turn, model patch).
 */
d('conversation threads HTTP flow', () => {
  let pg: TestPgContext
  let nuxt: NuxtServerContext

  beforeAll(async () => {
    pg = await startTestPg()
    nuxt = await startNuxtServer(pg.connectionString)
    await fetch(`${nuxt.baseUrl}/api/setup/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: nuxt.baseUrl },
      body: '{}'
    })
  }, 120_000)

  afterAll(async () => {
    await nuxt?.stop()
    await pg?.stop()
  })

  async function login(): Promise<string> {
    const r = await fetch(`${nuxt.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: nuxt.baseUrl },
      body: JSON.stringify({ username: nuxt.username, password: nuxt.password })
    })
    expect(r.status).toBe(200)
    const setCookie = r.headers.get('set-cookie') || ''
    return setCookie.split(';')[0]!
  }

  it('creates a thread, lists it, patches the title + model, then soft-deletes it', async () => {
    const cookie = await login()

    const created = await fetch(`${nuxt.baseUrl}/api/threads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: '{}'
    })
    expect(created.status).toBe(200)
    const { id } = await created.json() as { id: string }

    const list = await fetch(`${nuxt.baseUrl}/api/threads`, { headers: { cookie } })
    const listBody = await list.json() as { threads: Array<{ id: string, title: string }> }
    expect(listBody.threads.find((t) => t.id === id)?.title).toBe('New thread')

    const patch = await fetch(`${nuxt.baseUrl}/api/threads/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ title: 'Pricing strategy', model: 'openrouter/anthropic/claude-opus-4-7' })
    })
    expect(patch.status).toBe(200)

    const detail = await fetch(`${nuxt.baseUrl}/api/threads/${id}`, { headers: { cookie } })
    const detailBody = await detail.json() as { thread: { title: string, model: string } }
    expect(detailBody.thread.title).toBe('Pricing strategy')
    expect(detailBody.thread.model).toBe('openrouter/anthropic/claude-opus-4-7')

    const del = await fetch(`${nuxt.baseUrl}/api/threads/${id}`, {
      method: 'DELETE', headers: { cookie, origin: nuxt.baseUrl }
    })
    expect(del.status).toBe(200)

    // Soft-deleted thread vanishes from the list and the detail 404s.
    const listAfter = await fetch(`${nuxt.baseUrl}/api/threads`, { headers: { cookie } })
    const listAfterBody = await listAfter.json() as { threads: Array<{ id: string }> }
    expect(listAfterBody.threads.find((t) => t.id === id)).toBeUndefined()
    const detailAfter = await fetch(`${nuxt.baseUrl}/api/threads/${id}`, { headers: { cookie } })
    expect(detailAfter.status).toBe(404)
  })

  it('streams an SSE reply, persists both messages, surfaces sources, auto-titles the thread', async () => {
    const cookie = await login()
    const created = await fetch(`${nuxt.baseUrl}/api/threads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: '{}'
    })
    const { id } = await created.json() as { id: string }

    const response = await fetch(`${nuxt.baseUrl}/api/threads/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ content: 'What did we decide about embeddings last week?' })
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type') || '').toMatch(/event-stream/)
    expect(response.body).not.toBeNull()

    // Collect SSE events
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const events: Array<{ name: string, data: unknown }> = []
    let currentName = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (line.startsWith('event:')) currentName = line.slice(6).trim()
        else if (line.startsWith('data:')) {
          try { events.push({ name: currentName, data: JSON.parse(line.slice(5).trim()) }) } catch {}
        }
      }
    }

    const names = events.map((e) => e.name)
    expect(names).toContain('user')
    expect(names).toContain('sources')
    expect(names).toContain('done')

    const detail = await fetch(`${nuxt.baseUrl}/api/threads/${id}`, { headers: { cookie } })
    const detailBody = await detail.json() as {
      thread: { title: string }
      messages: Array<{ role: string, content: string, provider: string | null, sources: unknown[] | null }>
    }
    expect(detailBody.messages).toHaveLength(2)
    const userMsg = detailBody.messages.find((m) => m.role === 'user')
    const asstMsg = detailBody.messages.find((m) => m.role === 'assistant')
    expect(userMsg?.content).toMatch(/embeddings/)
    expect(asstMsg).toBeTruthy()
    // Placeholder provider in the test harness (no openrouter key).
    expect(asstMsg!.provider).toBe('placeholder')
    expect(asstMsg!.content.length).toBeGreaterThan(0)
    // Title was rewritten from "New thread" by the first-turn rename
    // (placeholder mode falls back to a truncated user message).
    expect(detailBody.thread.title).not.toBe('New thread')
    expect(detailBody.thread.title.length).toBeGreaterThan(0)
  }, 60_000)

  it('rejects an unauthenticated request with 401', async () => {
    const r = await fetch(`${nuxt.baseUrl}/api/threads`, { method: 'POST', body: '{}' })
    expect(r.status).toBe(401)
  })
})
