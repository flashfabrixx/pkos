type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'bkos.theme'

/**
 * Theme switching. Persists the user's choice in localStorage and
 * applies it via `data-theme` on <html>. "system" honors
 * `prefers-color-scheme` — that's the default for first-time visitors.
 *
 * Hydration: the choice is applied during `onMounted` to avoid SSR
 * mismatches; until then, the CSS @media query handles dark mode.
 */
export function useTheme() {
  const choice = useState<ThemeChoice>('bkos-theme', () => 'system')

  function apply(value: ThemeChoice) {
    choice.value = value
    if (!import.meta.client) return
    const html = document.documentElement
    if (value === 'system') {
      html.removeAttribute('data-theme')
      localStorage.removeItem(STORAGE_KEY)
    } else {
      html.setAttribute('data-theme', value)
      localStorage.setItem(STORAGE_KEY, value)
    }
  }

  function hydrateFromStorage() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null
    if (stored === 'light' || stored === 'dark') {
      choice.value = stored
      document.documentElement.setAttribute('data-theme', stored)
    }
  }

  function cycle() {
    const next: ThemeChoice = choice.value === 'system' ? 'light' : choice.value === 'light' ? 'dark' : 'system'
    apply(next)
  }

  return { choice, apply, cycle, hydrateFromStorage }
}
