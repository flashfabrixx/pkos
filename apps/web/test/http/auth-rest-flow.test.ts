import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'
import { startNuxtServer, type NuxtServerContext } from '../setup/nuxt-server'

const SKIP = process.env.PKOS_SKIP_NUXT_INTEGRATION === '1'
const d = SKIP ? describe.skip : describe

d('auth + REST v1 end-to-end', () => {
  let pg: TestPgContext
  let nuxt: NuxtServerContext

  beforeAll(async () => {
    pg = await startTestPg()
    nuxt = await startNuxtServer(pg.connectionString)
    // Complete setup so the onboarding middleware doesn't redirect.
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

  async function login() {
    const r = await fetch(`${nuxt.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: nuxt.baseUrl },
      body: JSON.stringify({ username: nuxt.username, password: nuxt.password })
    })
    expect(r.status).toBe(200)
    const cookie = r.headers.get('set-cookie') || ''
    expect(cookie).toMatch(/^pkos_session=/)
    return cookie.split(';')[0]!
  }

  it('rejects an unknown user with 401 and no cookie', async () => {
    const r = await fetch(`${nuxt.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: nuxt.baseUrl },
      body: JSON.stringify({ username: 'wrong', password: 'wrong' })
    })
    expect(r.status).toBe(401)
    expect(r.headers.get('set-cookie')).toBeNull()
  })

  it('signs the operator in and /api/auth/me confirms identity', async () => {
    const cookie = await login()
    const me = await fetch(`${nuxt.baseUrl}/api/auth/me`, {
      headers: { cookie }
    })
    expect(me.status).toBe(200)
    const body = await me.json() as { authenticated: boolean, username: string }
    expect(body.authenticated).toBe(true)
    expect(body.username).toBe(nuxt.username)
  })

  it('issues an API key over the session and accepts it on /api/v1', async () => {
    const cookie = await login()
    const createRes = await fetch(`${nuxt.baseUrl}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: 'integration-test' })
    })
    expect(createRes.status).toBe(200)
    const { plaintext } = await createRes.json() as { plaintext: string }
    expect(plaintext).toMatch(/^pkos_[0-9a-f]{8}_/)

    // Use the key against /api/v1 (no session cookie).
    const capture = await fetch(`${nuxt.baseUrl}/api/v1/captures`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${plaintext}`,
        origin: nuxt.baseUrl
      },
      body: JSON.stringify({
        sourceType: 'reflection',
        rawText: 'Integration test note: just a quick sanity capture for the v1 surface.',
        capturedAt: new Date().toISOString().slice(0, 10),
        confidentiality: 'private'
      })
    })
    expect(capture.status).toBe(200)
    const body = await capture.json() as { documentId: string, status: string }
    expect(body.status).toBe('processed')

    const fetched = await fetch(`${nuxt.baseUrl}/api/v1/captures/${body.documentId}`, {
      headers: { authorization: `Bearer ${plaintext}` }
    })
    expect(fetched.status).toBe(200)
    const doc = await fetched.json() as { document: { id: string } }
    expect(doc.document.id).toBe(body.documentId)
  }, 60_000)

  async function createKey(cookie: string, scopes?: string[]) {
    const r = await fetch(`${nuxt.baseUrl}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: `k-${Math.random().toString(36).slice(2, 8)}`, scopes })
    })
    expect(r.status).toBe(200)
    return (await r.json() as { plaintext: string, scopes: string[] })
  }

  async function postCapture(key: string, body: object) {
    const r = await fetch(`${nuxt.baseUrl}/api/v1/captures`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, origin: nuxt.baseUrl },
      body: JSON.stringify(body)
    })
    expect(r.status).toBe(200)
    return r.json() as Promise<{ documentId: string }>
  }

  it('search:read scope is required for /api/v1/search', async () => {
    const cookie = await login()
    const noSearch = await createKey(cookie) // defaults: no search:read
    const denied = await fetch(`${nuxt.baseUrl}/api/v1/search?q=hello`, {
      headers: { authorization: `Bearer ${noSearch.plaintext}` }
    })
    expect(denied.status).toBe(403)

    const withSearch = await createKey(cookie, ['captures:write', 'search:read'])
    await postCapture(withSearch.plaintext, {
      sourceType: 'reflection',
      rawText: 'Marvellous discovery about embeddings refresh cycles today.',
      capturedAt: new Date().toISOString().slice(0, 10),
      confidentiality: 'private'
    })
    const ok = await fetch(`${nuxt.baseUrl}/api/v1/search?q=embeddings`, {
      headers: { authorization: `Bearer ${withSearch.plaintext}` }
    })
    expect(ok.status).toBe(200)
    const body = await ok.json() as { mode: string, results: Array<{ title: string }> }
    expect(['hybrid', 'lexical']).toContain(body.mode)
    expect(Array.isArray(body.results)).toBe(true)
  }, 60_000)

  it('lists people through /api/v1/people with entities:read scope', async () => {
    const cookie = await login()
    const key = await createKey(cookie, ['entities:read'])
    const r = await fetch(`${nuxt.baseUrl}/api/v1/people?limit=5`, {
      headers: { authorization: `Bearer ${key.plaintext}` }
    })
    expect(r.status).toBe(200)
    const body = await r.json() as { people: unknown[], hasMore: boolean }
    expect(Array.isArray(body.people)).toBe(true)
    expect(typeof body.hasMore).toBe('boolean')
  })

  it('chat endpoint returns sources + placeholder answer without LLM provider', async () => {
    const cookie = await login()
    const key = await createKey(cookie, ['captures:write', 'chat:read'])
    await postCapture(key.plaintext, {
      sourceType: 'reflection',
      rawText: 'Strange anecdote about quokkas on Rottnest Island that I want to remember.',
      capturedAt: new Date().toISOString().slice(0, 10),
      confidentiality: 'private'
    })

    const r = await fetch(`${nuxt.baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.plaintext}`, origin: nuxt.baseUrl },
      body: JSON.stringify({ question: 'quokkas' })
    })
    expect(r.status).toBe(200)
    const body = await r.json() as { provider: string, answer: string, sources: unknown[] }
    expect(body.provider).toBe('placeholder')
    expect(body.answer.length).toBeGreaterThan(0)
    expect(Array.isArray(body.sources)).toBe(true)

    const empty = await fetch(`${nuxt.baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.plaintext}`, origin: nuxt.baseUrl },
      body: JSON.stringify({ question: '' })
    })
    expect(empty.status).toBe(400)
  }, 60_000)

  it('rejects a revoked API key with 401', async () => {
    const cookie = await login()
    const createRes = await fetch(`${nuxt.baseUrl}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: 'to-revoke' })
    })
    const created = await createRes.json() as { id: string, plaintext: string }

    await fetch(`${nuxt.baseUrl}/api/settings/api-keys/${created.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: nuxt.baseUrl }
    })

    const denied = await fetch(`${nuxt.baseUrl}/api/v1/entities`, {
      headers: { authorization: `Bearer ${created.plaintext}` }
    })
    expect(denied.status).toBe(401)
  })
})
