import { ingestEmail, parseAllowList, type IncomingEmail } from './email-ingest'
import { logger } from './logger'

/**
 * Connect to the IMAP server defined by MAIL_* env vars, pull every
 * UNSEEN message from INBOX, ingest it, and mark it Seen on success.
 * Returns counters for the scheduled task to log.
 *
 * The runtime imports of imapflow + mailparser are lazy so the rest of
 * the app doesn't pay for them when MAIL_HOST is unset.
 */
export async function pollImapInbox(): Promise<{ scanned: number, ingested: number, duplicates: number, rejected: number }> {
  const config = useRuntimeConfig() as {
    mailHost?: string
    mailPort?: string | number
    mailUser?: string
    mailPassword?: string
    mailSecure?: string
    mailFromAllow?: string
  }
  if (!config.mailHost) {
    return { scanned: 0, ingested: 0, duplicates: 0, rejected: 0 }
  }

  const { ImapFlow } = await import('imapflow')
  const { simpleParser } = await import('mailparser')

  const client = new ImapFlow({
    host: config.mailHost,
    port: Number(config.mailPort || 993),
    secure: String(config.mailSecure ?? 'true') !== 'false',
    auth: { user: config.mailUser || '', pass: config.mailPassword || '' },
    logger: false
  })

  const counters = { scanned: 0, ingested: 0, duplicates: 0, rejected: 0 }
  const allowList = parseAllowList(config.mailFromAllow)

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
        counters.scanned++
        if (!msg.source) continue
        const parsed = await simpleParser(msg.source)
        const messageId = parsed.messageId || msg.envelope?.messageId
        const sender = parsed.from?.value?.[0]?.address
        if (!messageId || !sender) {
          logger.warn({ component: 'email', uid: msg.uid }, 'skip: missing message-id or sender')
          continue
        }
        const incoming: IncomingEmail = {
          messageId,
          fromAddress: sender,
          subject: parsed.subject || '(no subject)',
          body: parsed.text || parsed.html || '',
          receivedAt: parsed.date || new Date(),
          attachments: (parsed.attachments || []).map((att) => ({
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            content: att.content as Buffer
          }))
        }
        const result = await ingestEmail(incoming, allowList)
        if (result.status === 'ingested') counters.ingested++
        else if (result.status === 'duplicate') counters.duplicates++
        else counters.rejected++
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }

  return counters
}
