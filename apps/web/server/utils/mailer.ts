import { logger } from './logger'

interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

type Transport = {
  send: (msg: MailMessage) => Promise<void>
  kind: 'smtp' | 'noop'
}

let cached: Transport | null = null

/**
 * Return a single configured nodemailer transport, or a no-op transport
 * if SMTP env vars are missing. The no-op variant simply logs the
 * intended send at info level so unit tests and demo installs see what
 * would have happened.
 */
export async function getMailer(): Promise<Transport> {
  if (cached) return cached
  const config = useRuntimeConfig() as {
    smtpHost?: string
    smtpPort?: string | number
    smtpUser?: string
    smtpPassword?: string
    smtpFrom?: string
    smtpSecure?: string
  }
  if (!config.smtpHost) {
    cached = {
      kind: 'noop',
      async send(msg) {
        logger.info({ component: 'mail', kind: 'noop', to: msg.to, subject: msg.subject }, 'mailer is no-op (SMTP_HOST unset) — message dropped')
      }
    }
    return cached
  }
  const { createTransport } = await import('nodemailer')
  const transporter = createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort || 587),
    secure: String(config.smtpSecure ?? 'false') === 'true',
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword || '' } : undefined
  })
  const from = config.smtpFrom || `PKOS <${config.smtpUser || 'pkos@localhost'}>`
  cached = {
    kind: 'smtp',
    async send(msg) {
      await transporter.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html })
    }
  }
  return cached
}

export function resetMailerForTests() {
  cached = null
}
