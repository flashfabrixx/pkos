import { describe, expect, it } from 'vitest'
import { recordLoginFailure, recordLoginSuccess, throwIfLocked } from '../../server/utils/rate-limit'

describe('rate-limit', () => {
  it('does not lock before 5 fails', () => {
    const key = `t1-${Math.random()}`
    for (let i = 0; i < 4; i++) recordLoginFailure(key)
    expect(() => throwIfLocked(key)).not.toThrow()
  })

  it('locks on the 5th failure', () => {
    const key = `t2-${Math.random()}`
    for (let i = 0; i < 5; i++) recordLoginFailure(key)
    let captured: { statusCode?: number, data?: { retryAfter?: number } } | null = null
    try { throwIfLocked(key) } catch (e: any) { captured = e }
    expect(captured?.statusCode).toBe(429)
    expect(captured?.data?.retryAfter).toBeGreaterThan(0)
  })

  it('a successful login resets the bucket', () => {
    const key = `t3-${Math.random()}`
    for (let i = 0; i < 5; i++) recordLoginFailure(key)
    recordLoginSuccess(key)
    expect(() => throwIfLocked(key)).not.toThrow()
  })
})
