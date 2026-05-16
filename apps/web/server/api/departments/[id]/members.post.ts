import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { query } from '../../../utils/db'

const schema = z.object({
  member_id: z.string().uuid(),
  kind: z.enum(['person', 'project']),
  role: z.string().trim().max(120).optional(),
  started_on: z.string().trim().max(32).optional(),
  ended_on: z.string().trim().max(32).optional()
})

/**
 * Add a person or project to a department. Idempotent via the
 * (department_id, member_id, kind) unique key.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const ensure = await query<{ type: string }>(
    `SELECT type FROM entities WHERE id = $1 AND deleted_at IS NULL`,
    [body.member_id]
  )
  const memberType = ensure.rows[0]?.type
  if (!memberType) throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  if (memberType !== body.kind) {
    throw createError({ statusCode: 400, statusMessage: `Member type '${memberType}' does not match kind '${body.kind}'` })
  }

  const result = await query<{ id: string }>(
    `INSERT INTO department_memberships (department_id, member_id, kind, role, started_on, ended_on)
     VALUES ($1, $2, $3, $4, NULLIF($5,'')::date, NULLIF($6,'')::date)
     ON CONFLICT (department_id, member_id, kind) DO UPDATE
       SET role = EXCLUDED.role,
           started_on = EXCLUDED.started_on,
           ended_on = EXCLUDED.ended_on
     RETURNING id`,
    [id, body.member_id, body.kind, body.role || null, body.started_on || '', body.ended_on || '']
  )
  return { membership_id: result.rows[0]!.id }
})
