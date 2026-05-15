/**
 * Production error handler: hide stack traces and internal error data from
 * the response body. Dev gets the verbose Nitro default.
 */
export default defineNitroPlugin((nitroApp) => {
  if (process.env.NODE_ENV !== 'production') return
  nitroApp.hooks.hook('error', (error, { event }) => {
    // Log to server (operators can read it) but don't leak to client.
    console.error('[bkos][error]', {
      url: event?.path,
      message: (error as Error).message
    })
  })

  nitroApp.hooks.hook('beforeResponse', (event, { body }) => {
    if (!body || typeof body !== 'object') return
    const error = body as { statusCode?: number, statusMessage?: string, stack?: unknown, data?: unknown }
    if (error.statusCode && error.statusCode >= 500) {
      delete error.stack
      delete error.data
      error.statusMessage = 'Internal server error'
    } else if (error.statusCode) {
      delete error.stack
    }
  })
})
