import { query } from './db'

export interface PeopleListInput {
  q?: string
  limit?: number
  offset?: number
}

export interface PersonRow {
  id: string
  name: string
  document_count: number
  actions_open: number
  actions_done: number
  last_seen: string | null
}

export interface PeopleListResponse {
  people: PersonRow[]
  hasMore: boolean
}

export async function listPeople(input: PeopleListInput = {}): Promise<PeopleListResponse> {
  const q = (input.q ?? '').trim()
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200)
  const offset = Math.max(Number(input.offset) || 0, 0)

  const values: Array<string | number> = []
  let whereClause = `e.type = 'person' AND e.deleted_at IS NULL`
  if (q) {
    values.push(`%${q}%`)
    whereClause += ` AND e.name ILIKE $${values.length}`
  }
  values.push(limit)
  const limitIdx = values.length
  values.push(offset)
  const offsetIdx = values.length

  const result = await query<PersonRow>(
    `SELECT e.id, e.name,
       (SELECT COUNT(DISTINCT em.document_id)::int FROM entity_mentions em
          JOIN documents d ON d.id = em.document_id
          WHERE em.entity_id = e.id AND d.deleted_at IS NULL) AS document_count,
       (SELECT COUNT(*)::int FROM action_items WHERE person_id = e.id AND status = 'open' AND deleted_at IS NULL) AS actions_open,
       (SELECT COUNT(*)::int FROM action_items WHERE person_id = e.id AND status = 'done' AND deleted_at IS NULL) AS actions_done,
       (SELECT MAX(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = e.id AND d.deleted_at IS NULL) AS last_seen
     FROM entities e
     WHERE ${whereClause}
     ORDER BY e.name
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )
  return {
    people: result.rows,
    hasMore: result.rows.length === limit
  }
}
