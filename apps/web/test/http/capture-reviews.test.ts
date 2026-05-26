import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'
import { startNuxtServer, type NuxtServerContext } from '../setup/nuxt-server'

const SKIP = process.env.PKOS_SKIP_NUXT_INTEGRATION === '1'
const d = SKIP ? describe.skip : describe

/**
 * The emission path (extractor → review row) lives in the DB test
 * suite — it requires direct pg access to seed entities at specific
 * trigram-similarity distances. Here we just verify the HTTP surface
 * of /api/reviews: auth, empty state, and error cases on /resolve.
 */
d('capture reviews API surface', () => {
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
  }, 300_000)

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
    return (r.headers.get('set-cookie') || '').split(';')[0]!
  }

  it('returns 401 without auth', async () => {
    const r = await fetch(`${nuxt.baseUrl}/api/reviews`, { headers: { origin: nuxt.baseUrl } })
    expect(r.status).toBe(401)
  })

  it('count endpoint returns 0 when nothing is open', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/reviews?count=1`, { headers: { cookie } })
    expect(r.status).toBe(200)
    const body = await r.json() as { count: number }
    expect(body.count).toBe(0)
  })

  it('list endpoint returns an empty array when nothing is open', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/reviews`, { headers: { cookie } })
    expect(r.status).toBe(200)
    const body = await r.json() as { reviews: unknown[], count: number }
    expect(body.reviews).toEqual([])
    expect(body.count).toBe(0)
  })

  it('resolve returns 404 for an unknown id', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/reviews/00000000-0000-0000-0000-000000000000/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ action: 'skip' })
    })
    expect(r.status).toBe(404)
  })

  it('resolve rejects an invalid action with 400', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/reviews/00000000-0000-0000-0000-000000000000/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ action: 'nuke' })
    })
    expect(r.status).toBe(400)
  })
})
