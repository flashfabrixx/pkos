export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const { data } = await useFetch('/api/auth/me', {
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
  })

  if (!data.value?.authenticated) {
    return navigateTo('/login')
  }
})
