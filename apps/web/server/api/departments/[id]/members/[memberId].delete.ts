import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { query } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')
  if (!id || !memberId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `DELETE FROM department_memberships WHERE id = $1 AND department_id = $2 RETURNING id`,
    [memberId, id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
  return { removed: true }
})
