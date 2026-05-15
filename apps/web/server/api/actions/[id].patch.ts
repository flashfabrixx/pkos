import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { actionStatuses } from '@bkos/core'
import { requireAuth } from '../../utils/auth'
import { query, withTransaction } from '../../utils/db'
import { upsertEntity } from '../../utils/graph'

const schema = z.object({
  status: z.enum(actionStatuses).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: z.string().trim().max(32).nullable().optional(),
  personId: z.string().uuid().nullable().optional(),
  personName: z.string().trim().min(1).max(200).optional()
}).refine(
  (value) =>
    value.status ||
    value.title ||
    value.description !== undefined ||
    value.dueDate !== undefined ||
    value.personId !== undefined ||
    value.personName !== undefined,
  { message: 'At least one field must be provided' }
)

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const body = schema.parse(await readBody(event))

  const updates: string[] = []
  const values: Array<string | null> = []

  if (body.status) {
    values.push(body.status)
    updates.push(`status = $${values.length}`)
  }

  if (body.title) {
    values.push(body.title)
    updates.push(`title = $${values.length}`)
  }

  if (body.description !== undefined) {
    values.push(body.description || null)
    updates.push(`description = $${values.length}`)
  }

  if (body.dueDate !== undefined) {
    values.push(body.dueDate || null)
    updates.push(`due_date = $${values.length}`)
  }

  let nextPersonId: string | null | undefined
  if (body.personId !== undefined) {
    nextPersonId = body.personId
  } else if (body.personName !== undefined) {
    nextPersonId = await withTransaction(async (client) => {
      const entity = await upsertEntity(client, 'person', body.personName!)
      return entity.id
    })
  }

  if (nextPersonId !== undefined) {
    values.push(nextPersonId)
    updates.push(`person_id = $${values.length}`)
  }

  if (!updates.length) {
    throw createError({ statusCode: 400, statusMessage: 'No updates supplied' })
  }

  values.push(id)

  const result = await query(
    `UPDATE action_items a
     SET ${updates.join(', ')}, updated_at = now()
     FROM (SELECT id FROM action_items WHERE id = $${values.length}) target
     WHERE a.id = target.id
     RETURNING a.id, a.title, a.description, a.status, a.due_date, a.document_id, a.person_id, a.created_at,
       (SELECT name FROM entities WHERE id = a.person_id) AS person_name`,
    values
  )

  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Action item not found' })
  return { action: result.rows[0] }
})
