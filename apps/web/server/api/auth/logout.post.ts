import { clearSessionCookie, getSessionUser, revokeAllSessions } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)
  clearSessionCookie(event)
  await revokeAllSessions()
  await recordAudit({ event, actor: user, action: 'auth.logout' })
  return { authenticated: false }
})
