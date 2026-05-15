import { franc } from 'franc-min'

// franc-min returns ISO 639-3 codes. We map only languages that Postgres
// ships a TSV config for; everything else falls through to `simple`.
const ISO3_TO_ISO1: Record<string, string> = {
  eng: 'en',
  deu: 'de',
  fra: 'fr',
  spa: 'es',
  ita: 'it',
  nld: 'nl',
  por: 'pt',
  rus: 'ru',
  swe: 'sv',
  dan: 'da',
  fin: 'fi',
  nor: 'no',
  hun: 'hu',
  ron: 'ro',
  tur: 'tr'
}

// Mapping ISO 639-1 → Postgres default TSV config name.
const ISO1_TO_PG_CONFIG: Record<string, string> = {
  en: 'english',
  de: 'german',
  fr: 'french',
  es: 'spanish',
  it: 'italian',
  nl: 'dutch',
  pt: 'portuguese',
  ru: 'russian',
  sv: 'swedish',
  da: 'danish',
  fi: 'finnish',
  no: 'norwegian',
  hu: 'hungarian',
  ro: 'romanian',
  tr: 'turkish'
}

export interface LanguageDetection {
  /** ISO 639-1 code, e.g. 'en', 'de'. Null when detection is too unsure. */
  code: string | null
  /** Postgres TSV config name to use when indexing / querying. */
  pgConfig: string
}

export function detectLanguage(text: string): LanguageDetection {
  const sample = text.trim()
  if (sample.length < 24) return { code: null, pgConfig: 'simple' }

  // franc returns 'und' (undetermined) when confidence is low.
  const iso3 = franc(sample, { minLength: 24 })
  if (!iso3 || iso3 === 'und') return { code: null, pgConfig: 'simple' }

  const iso1 = ISO3_TO_ISO1[iso3]
  if (!iso1) return { code: null, pgConfig: 'simple' }

  return { code: iso1, pgConfig: ISO1_TO_PG_CONFIG[iso1] || 'simple' }
}

export function pgConfigFor(languageCode: string | null | undefined): string {
  if (!languageCode) return 'simple'
  return ISO1_TO_PG_CONFIG[languageCode] || 'simple'
}

export interface LanguageOption {
  code: string
  label: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'no', label: 'Norsk' },
  { code: 'hu', label: 'Magyar' },
  { code: 'ro', label: 'Română' },
  { code: 'tr', label: 'Türkçe' }
]

export function isSupportedLanguageCode(code: string): boolean {
  return LANGUAGE_OPTIONS.some((option) => option.code === code)
}
