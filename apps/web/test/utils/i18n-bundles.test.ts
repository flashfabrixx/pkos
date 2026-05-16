import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import de from '../../i18n/de.json'

function flatKeys(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') return flatKeys(value, path)
    return [path]
  })
}

describe('i18n bundles', () => {
  it('keep en and de in parity', () => {
    const enKeys = flatKeys(en).sort()
    const deKeys = flatKeys(de).sort()
    expect(deKeys).toEqual(enKeys)
  })
})
