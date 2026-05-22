import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { getPool } from '../../../utils/db'
import { compileEntityExport } from '../../../utils/entity-export'

/**
 * Markdown briefing for a person / project / tag. Consolidates the
 * entity's mentioned documents, open + closed action items,
 * decisions, insights, open questions, related entities, and the
 * comments tied to the entity itself.
 *
 * Intended for the "Copy as Markdown" button on each entity's detail
 * page so the user can paste the full picture into a chat workbench
 * (Claude etc.) and pick up from there.
 *
 * Cookie auth only - this is an internal helper, not part of the
 * versioned /api/v1/* surface.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  try {
    const markdown = await compileEntityExport(getPool(), id)
    return {
      markdown,
      generatedAt: new Date().toISOString()
    }
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.includes('not found')) {
      throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
    }
    if (message.includes('unsupported type')) {
      throw createError({ statusCode: 400, statusMessage: 'Entity type cannot be exported' })
    }
    throw error
  }
})
