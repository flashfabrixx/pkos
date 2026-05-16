import { createI18n } from 'vue-i18n'
import en from '../../i18n/en.json'
import de from '../../i18n/de.json'

const STORAGE_KEY = 'bkos.locale'
const SUPPORTED = ['en', 'de'] as const
type Locale = typeof SUPPORTED[number]

/**
 * Boot vue-i18n with EN + DE bundled. First-visit locale comes from
 * navigator.language; later we honour an explicit choice persisted in
 * localStorage via `setLocale()`. Missing keys log a warning in dev so
 * extraction gaps are visible.
 */
export default defineNuxtPlugin((nuxt) => {
  const initialLocale = pickInitialLocale()
  const i18n = createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'en',
    missingWarn: process.env.NODE_ENV !== 'production',
    fallbackWarn: false,
    messages: { en, de }
  })
  nuxt.vueApp.use(i18n)
})

function pickInitialLocale(): Locale {
  if (!import.meta.client) return 'en'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'de') return stored
  const nav = navigator.language?.slice(0, 2).toLowerCase()
  return (SUPPORTED as readonly string[]).includes(nav as Locale) ? (nav as Locale) : 'en'
}
