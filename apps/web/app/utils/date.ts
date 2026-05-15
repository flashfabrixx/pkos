// Pin the locale so server-rendered output matches the client and
// avoids Vue hydration mismatches on dates.
const DATE_LOCALE = 'en-GB'

export function formatBrowserDate(value: string | null | undefined, fallback = '') {
  if (!value) return fallback
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)

  return new Intl.DateTimeFormat(DATE_LOCALE, {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(date)
}

export function formatBrowserDateTime(value: string | null | undefined, fallback = '') {
  if (!value) return fallback
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
