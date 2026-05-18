import { getQuery } from 'h3'
import { requireAuthOrApiKey } from '../../utils/auth'
import { parseSearchListParam, runHybridSearch } from '../../utils/search'

/**
 * Public hybrid-search surface. Same logic as the internal `/api/search`,
 * but authenticated via Bearer API key (scope `search:read`) or session.
 */
export default defineEventHandler(async (event) => {
  await requireAuthOrApiKey(event, 'search:read')
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q : ''
  const limitRaw = typeof params.limit === 'string' ? Number(params.limit) : undefined

  return runHybridSearch({
    q,
    kinds: parseSearchListParam(params.kinds),
    lang: typeof params.lang === 'string' ? params.lang : null,
    dateFrom: typeof params.from === 'string' ? params.from : null,
    dateTo: typeof params.to === 'string' ? params.to : null,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined
  })
})
