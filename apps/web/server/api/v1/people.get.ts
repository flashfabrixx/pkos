import { getQuery } from 'h3'
import { requireAuthOrApiKey } from '../../utils/auth'
import { listPeople } from '../../utils/people'

/**
 * Public people list. Reuses the internal handler logic but authenticated
 * via Bearer API key (scope `entities:read`) or session.
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'entities:read')
  const params = getQuery(event)
  return listPeople({
    q: typeof params.q === 'string' ? params.q : undefined,
    limit: Number(params.limit) || undefined,
    offset: Number(params.offset) || undefined
  })
})
