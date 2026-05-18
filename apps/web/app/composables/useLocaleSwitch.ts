import { useI18n } from 'vue-i18n'

const STORAGE_KEY = 'pkos.locale'

export function useLocaleSwitch() {
  const i18n = useI18n()

  function setLocale(locale: 'en' | 'de') {
    i18n.locale.value = locale
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, locale)
  }

  return {
    locale: i18n.locale,
    setLocale,
    available: ['en', 'de'] as const
  }
}
