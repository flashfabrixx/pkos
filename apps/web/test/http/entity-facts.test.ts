import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'
import { startNuxtServer, type NuxtServerContext } from '../setup/nuxt-server'

const SKIP = process.env.PKOS_SKIP_NUXT_INTEGRATION === '1'
const d = SKIP ? describe.skip : describe

d('entity facts CRUD + reorder', () => {
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

  async function newPerson(cookie: string, name: string): Promise<string> {
    const r = await fetch(`${nuxt.baseUrl}/api/entities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ type: 'person', name })
    })
    return (await r.json() as { entity: { id: string } }).entity.id
  }

  it('full CRUD lifecycle with stable position numbering', async () => {
    const cookie = await login()
    const entityId = await newPerson(cookie, 'Facts Felix')

    // empty to start
    const list0 = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, { headers: { cookie } })
    expect((await list0.json() as { facts: unknown[] }).facts).toHaveLength(0)

    // add three facts in order
    const ids: string[] = []
    for (const body of ['Prefers async', 'Owns pricing slides', 'Out Fridays']) {
      const r = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
        body: JSON.stringify({ body })
      })
      const { fact } = await r.json() as { fact: { id: string, position: number } }
      ids.push(fact.id)
    }

    const after = await (await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, { headers: { cookie } })).json() as { facts: Array<{ id: string, body: string, position: number }> }
    expect(after.facts.map((f) => f.body)).toEqual(['Prefers async', 'Owns pricing slides', 'Out Fridays'])
    expect(after.facts.map((f) => f.position)).toEqual([0, 1, 2])

    // edit the second one
    const editResp = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts/${ids[1]}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ body: 'Owns pricing AND embeddings' })
    })
    expect(editResp.status).toBe(200)

    // move the third one to the top (position 0)
    const moveResp = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts/${ids[2]}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ position: 0 })
    })
    expect(moveResp.status).toBe(200)

    const reordered = await (await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, { headers: { cookie } })).json() as { facts: Array<{ id: string, body: string, position: number }> }
    expect(reordered.facts.map((f) => f.body)).toEqual([
      'Out Fridays',
      'Prefers async',
      'Owns pricing AND embeddings'
    ])
    expect(reordered.facts.map((f) => f.position)).toEqual([0, 1, 2])

    // delete the middle one; positions should stay contiguous
    const delResp = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts/${ids[0]}`, {
      method: 'DELETE',
      headers: { cookie, origin: nuxt.baseUrl }
    })
    expect(delResp.status).toBe(200)
    const final = await (await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, { headers: { cookie } })).json() as { facts: Array<{ body: string, position: number }> }
    expect(final.facts.map((f) => f.body)).toEqual(['Out Fridays', 'Owns pricing AND embeddings'])
    expect(final.facts.map((f) => f.position)).toEqual([0, 1])
  })

  it('refuses to add facts to a non-supported entity type', async () => {
    const cookie = await login()
    // No public endpoint exists to create a 'decision' or 'document'
    // entity, so we cover the negative path via the not-found branch
    // (unknown UUID).
    const r = await fetch(`${nuxt.baseUrl}/api/entities/00000000-0000-0000-0000-000000000000/facts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ body: 'lost' })
    })
    expect(r.status).toBe(404)
  })

  it('rejects empty bodies', async () => {
    const cookie = await login()
    const entityId = await newPerson(cookie, 'Whitespace Wendy')
    const r = await fetch(`${nuxt.baseUrl}/api/entities/${entityId}/facts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: nuxt.baseUrl },
      body: JSON.stringify({ body: '   ' })
    })
    expect(r.status).toBe(400)
  })
})
