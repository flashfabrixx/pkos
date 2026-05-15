import { clearSessionCookie, revokeAllSessions } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  clearSessionCookie(event)
  await revokeAllSessions()
  return { authenticated: false }
})
