import { sendActionDigest } from '../utils/action-reminder'
import { logger } from '../utils/logger'

export default defineTask({
  meta: {
    name: 'reminders:actions',
    description: 'Sends the daily due/overdue actions digest.'
  },
  async run() {
    try {
      const result = await sendActionDigest()
      return { result }
    } catch (error) {
      logger.error({ component: 'reminders', err: (error as Error).message }, 'reminder digest failed')
      throw error
    }
  }
})
