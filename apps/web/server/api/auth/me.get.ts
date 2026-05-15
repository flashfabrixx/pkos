import { getSessionUser } from '../../utils/auth'

export default defineEventHandler((event) => {
  const username = getSessionUser(event)
  return { authenticated: Boolean(username), username }
})
