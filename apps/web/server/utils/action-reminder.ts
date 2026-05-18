import { query } from './db'
import { logger } from './logger'
import { getMailer } from './mailer'

interface ActionRow {
  id: string
  title: string
  due_date: string | null
  person_name: string | null
  project_name: string | null
  document_title: string
  status: 'overdue' | 'today'
}

/**
 * Build and send the daily action-reminder digest. The query returns
 * open actions with a due date that is either today or in the past;
 * the digest groups them by bucket so the operator sees the overdue
 * pile first.
 */
export async function sendActionDigest(): Promise<{ sent: boolean, count: number, recipient: string | null }> {
  const config = useRuntimeConfig() as { reminderEmail?: string }
  const recipient = (config.reminderEmail || '').trim() || null
  if (!recipient) {
    return { sent: false, count: 0, recipient: null }
  }

  const result = await query<ActionRow>(
    `SELECT a.id, a.title, a.due_date::text AS due_date,
            pe.name AS person_name, pr.name AS project_name,
            d.title AS document_title,
            CASE
              WHEN a.due_date < CURRENT_DATE THEN 'overdue'
              ELSE 'today'
            END AS status
       FROM action_items a
       JOIN documents d ON d.id = a.document_id
       LEFT JOIN entities pe ON pe.id = a.person_id
       LEFT JOIN entities pr ON pr.id = a.project_id
      WHERE a.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND a.status = 'open'
        AND a.due_date IS NOT NULL
        AND a.due_date <= CURRENT_DATE
      ORDER BY a.due_date ASC, a.created_at ASC`
  )

  if (!result.rows.length) {
    logger.info({ component: 'reminders' }, 'no due actions, skipping digest')
    return { sent: false, count: 0, recipient }
  }

  const overdue = result.rows.filter((r) => r.status === 'overdue')
  const today = result.rows.filter((r) => r.status === 'today')

  const text = [
    overdue.length ? `OVERDUE (${overdue.length}):` : '',
    ...overdue.map(formatRow),
    overdue.length ? '' : '',
    today.length ? `DUE TODAY (${today.length}):` : '',
    ...today.map(formatRow)
  ].filter(Boolean).join('\n')

  await (await getMailer()).send({
    to: recipient,
    subject: `PKOS · ${overdue.length} overdue, ${today.length} due today`,
    text
  })

  logger.info({ component: 'reminders', count: result.rows.length, recipient }, 'action digest sent')
  return { sent: true, count: result.rows.length, recipient }
}

function formatRow(row: ActionRow): string {
  const date = row.due_date || ''
  const owner = row.person_name ? ` · ${row.person_name}` : ''
  const project = row.project_name ? ` (${row.project_name})` : ''
  return `  ${date}${project}${owner} — ${row.title}`
}
