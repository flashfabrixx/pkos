// Routes reachable without a session. The setup wizard runs before any
// user exists, so it must be exempt; the login page is the destination
// for everything else when unauthenticated.
const PUBLIC_PATHS = new Set(['/login', '/setup'])

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_PATHS.has(to.path)) return

  const { data } = await useFetch('/api/auth/me', {
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
  })

  if (!data.value?.authenticated) {
    return navigateTo('/login')
  }
})
