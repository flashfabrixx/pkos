import { query } from './db'

let cached: { completed: boolean, loadedAt: number } | null = null
const TTL_MS = 30_000

/**
 * Caches the singleton setup_state row briefly so the onboarding
 * middleware doesn't roundtrip Postgres on every request. The cache is
 * invalidated by `markSetupComplete()` and time-expires after 30s, so
 * concurrent workers see updates without explicit pub/sub.
 */
export async function isSetupComplete(): Promise<boolean> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.completed
  try {
    const r = await query<{ completed_at: string | null }>(`SELECT completed_at FROM setup_state WHERE id = 1`)
    const completed = Boolean(r.rows[0]?.completed_at)
    cached = { completed, loadedAt: Date.now() }
    return completed
  } catch {
    // DB not reachable yet → behave as not-complete so /setup gets a
    // chance to render the failure case rather than a generic 500.
    return false
  }
}

export async function markSetupComplete(notes: Record<string, unknown> = {}): Promise<void> {
  await query(
    `UPDATE setup_state SET completed_at = now(), notes = $1::jsonb WHERE id = 1`,
    [JSON.stringify(notes)]
  )
  cached = { completed: true, loadedAt: Date.now() }
}

export function invalidateSetupCache() {
  cached = null
}
