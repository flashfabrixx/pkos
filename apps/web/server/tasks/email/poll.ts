import { pollImapInbox } from '../../utils/imap'
import { logger } from '../../utils/logger'

/**
 * Nitro scheduled task wrapper. Configured to run every 5 minutes in
 * nuxt.config.ts via `nitro.scheduledTasks`. No-ops when MAIL_HOST is
 * unset so installations without email keep zero overhead.
 */
export default defineTask({
  meta: {
    name: 'email:poll',
    description: 'Pulls unseen mail from IMAP INBOX into BKOS captures.'
  },
  async run() {
    try {
      const counters = await pollImapInbox()
      if (counters.scanned > 0) {
        logger.info({ component: 'email', ...counters }, 'imap poll cycle')
      }
      return { result: counters }
    } catch (error) {
      logger.error({ component: 'email', err: (error as Error).message }, 'imap poll failed')
      throw error
    }
  }
})
