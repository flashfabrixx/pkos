import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'
import { startNuxtServer, type NuxtServerContext } from '../setup/nuxt-server'

const SKIP = process.env.PKOS_SKIP_NUXT_INTEGRATION === '1'
const d = SKIP ? describe.skip : describe

d('saved views CRUD', () => {
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

  it('returns 401 when unauthenticated', async () => {
    const r = await fetch(`${nuxt.baseUrl}/api/saved-views`, {
      headers: { origin: nuxt.baseUrl }
    })
    expect(r.status).toBe(401)
  })

  it('full create / list / update / delete lifecycle', async () => {
    const cookie = await login()
    // Empty to start.
    const list0 = await fetch(`${nuxt.baseUrl}/api/saved-views`, { headers: { cookie } })
    expect((await list0.json() as { views: unknown[] }).views).toHaveLength(0)

    // Create.
    const created = await (await fetch(`${nuxt.baseUrl}/api/saved-views`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({
        name: 'Anna recent',
        q: 'anna mueller',
        filters: { kinds: ['reflection'], lang: 'en', from: '2026-01-01' }
      })
    })).json() as { view: { id: string, name: string, q: string, filters: any } }
    expect(created.view.name).toBe('Anna recent')
    expect(created.view.filters.kinds).toEqual(['reflection'])

    // List shows it.
    const list1 = await (await fetch(`${nuxt.baseUrl}/api/saved-views`, { headers: { cookie } })).json() as { views: any[] }
    expect(list1.views).toHaveLength(1)
    expect(list1.views[0]!.id).toBe(created.view.id)

    // Patch the name.
    const patched = await (await fetch(`${nuxt.baseUrl}/api/saved-views/${created.view.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: 'Anna · recent activity' })
    })).json() as { view: { name: string, q: string } }
    expect(patched.view.name).toBe('Anna · recent activity')
    expect(patched.view.q).toBe('anna mueller')

    // Delete.
    const delResp = await fetch(`${nuxt.baseUrl}/api/saved-views/${created.view.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: nuxt.baseUrl }
    })
    expect(delResp.status).toBe(200)

    const list2 = await (await fetch(`${nuxt.baseUrl}/api/saved-views`, { headers: { cookie } })).json() as { views: unknown[] }
    expect(list2.views).toHaveLength(0)
  })

  it('rejects empty names with 400', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/saved-views`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: '   ' })
    })
    expect(r.status).toBe(400)
  })

  it('rejects unknown filter keys (strict schema)', async () => {
    const cookie = await login()
    const r = await fetch(`${nuxt.baseUrl}/api/saved-views`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ name: 'Bad', filters: { mystery: 1 } })
    })
    expect(r.status).toBe(400)
  })
})
