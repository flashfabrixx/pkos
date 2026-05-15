import { createError, readBody } from 'h3'
import { z } from 'zod'
import { createSession, setSessionCookie } from '../../utils/auth'

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = schema.parse(await readBody(event))

  if (body.username !== config.username || body.password !== config.password) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  setSessionCookie(event, createSession(body.username, config.sessionSecret))
  return { authenticated: true, username: body.username }
})
