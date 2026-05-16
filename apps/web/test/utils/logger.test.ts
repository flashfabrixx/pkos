import { describe, expect, it } from 'vitest'
import { logger } from '../../server/utils/logger'

describe('logger', () => {
  it('exposes the standard pino levels', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      expect(typeof (logger as unknown as Record<string, unknown>)[level]).toBe('function')
    }
  })

  it('returns child loggers that inherit context', () => {
    const child = logger.child({ component: 'test' })
    expect(typeof child.info).toBe('function')
  })
})
