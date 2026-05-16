import { recomputeSuggestions } from '../../utils/suggest-links'
import { logger } from '../../utils/logger'

export default defineTask({
  meta: {
    name: 'suggestions:entities',
    description: 'Recompute entity-link suggestions from embeddings.'
  },
  async run() {
    try {
      const counters = await recomputeSuggestions()
      return { result: counters }
    } catch (error) {
      logger.error({ component: 'suggestions', err: (error as Error).message }, 'suggestion pass failed')
      throw error
    }
  }
})
