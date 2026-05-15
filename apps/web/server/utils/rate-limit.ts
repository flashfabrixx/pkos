import { createError } from 'h3'

interface Bucket {
  fails: number
  lockedUntil: number
}

const MAX_FAILS = 5
const WINDOW_MS = 5 * 60 * 1000
const LOCK_MS = 5 * 60 * 1000

// In-memory bucket per IP. Single-instance assumption; for HA deploys swap
// in a shared store (Redis / Nitro storage).
const buckets = new Map<string, Bucket>()

function getBucket(key: string): Bucket {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { fails: 0, lockedUntil: 0 }
    buckets.set(key, bucket)
  }
  return bucket
}

export function throwIfLocked(key: string) {
  const bucket = buckets.get(key)
  if (!bucket) return
  const now = Date.now()
  if (bucket.lockedUntil > now) {
    const retryAfter = Math.ceil((bucket.lockedUntil - now) / 1000)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Try again later.',
      data: { retryAfter }
    })
  }
}

export function recordLoginFailure(key: string) {
  const bucket = getBucket(key)
  const now = Date.now()
  // Reset window if last failure was a while ago.
  if (bucket.lockedUntil && bucket.lockedUntil + WINDOW_MS < now) {
    bucket.fails = 0
    bucket.lockedUntil = 0
  }
  bucket.fails += 1
  if (bucket.fails >= MAX_FAILS) {
    bucket.lockedUntil = now + LOCK_MS
  }
}

export function recordLoginSuccess(key: string) {
  buckets.delete(key)
}
