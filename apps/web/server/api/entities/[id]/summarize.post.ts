import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { summariseEntity } from '../../../utils/summarize-entity'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const result = await summariseEntity(id)
  return result
})
