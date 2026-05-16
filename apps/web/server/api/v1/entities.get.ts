import { getQuery } from 'h3'
import { requireAuthOrApiKey } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'entities:read')
  const params = getQuery(event)
  const type = typeof params.type === 'string' ? params.type : null
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200)
  const offset = Math.max(Number(params.offset) || 0, 0)

  const values: Array<string | number> = []
  const where: string[] = ['deleted_at IS NULL']
  if (type) {
    values.push(type)
    where.push(`type = $${values.length}`)
  }
  if (q) {
    values.push(`%${q}%`)
    where.push(`(name ILIKE $${values.length} OR canonical_name ILIKE $${values.length})`)
  }
  values.push(limit)
  const limitIdx = values.length
  values.push(offset)
  const offsetIdx = values.length

  const result = await query(
    `SELECT id, type, name, canonical_name, metadata, created_at, updated_at
       FROM entities
      WHERE ${where.join(' AND ')}
      ORDER BY name
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )
  return { entities: result.rows, hasMore: result.rows.length === limit }
})
