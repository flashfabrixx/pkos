import { ingestEmail, parseAllowList, type IncomingEmail } from './email-ingest'
import { logger } from './logger'

// mailparser ships no types; describe just the shape we use.
interface ParsedAttachment {
  filename?: string
  contentType?: string
  content: Buffer
}
interface ParsedMail {
  messageId?: string
  from?: { value?: Array<{ address?: string }> }
  subject?: string
  text?: string
  html?: string | false
  date?: Date
  attachments?: ParsedAttachment[]
}

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
  // mailparser ships no types — assert the dynamic import to our local shape.
  // @ts-expect-error untyped CJS module
  const mailparser = await import('mailparser') as unknown as {
    simpleParser: (source: Buffer | NodeJS.ReadableStream) => Promise<ParsedMail>
  }
  const { simpleParser } = mailparser

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
          body: parsed.text || (typeof parsed.html === 'string' ? parsed.html : '') || '',
          receivedAt: parsed.date || new Date(),
          attachments: (parsed.attachments || []).map((att) => ({
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            content: att.content
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
