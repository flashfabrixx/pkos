import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `UPDATE documents SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  await recordAudit({ event, actor, action: 'capture.delete', resourceKind: 'document', resourceId: id })
  return { deleted: true, id }
})
