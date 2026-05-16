import { drainWebhookQueue } from '../utils/webhook-deliver'
import { logger } from '../utils/logger'

export default defineTask({
  meta: {
    name: 'webhook:retry',
    description: 'Drain pending webhook_deliveries (HMAC-signed POSTs).'
  },
  async run() {
    try {
      const stats = await drainWebhookQueue()
      return { result: stats }
    } catch (error) {
      logger.error({ component: 'webhook', err: (error as Error).message }, 'webhook drain failed')
      throw error
    }
  }
})
