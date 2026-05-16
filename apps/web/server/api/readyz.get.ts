import { access, constants } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setResponseStatus } from 'h3'
import { query } from '../utils/db'
import { loggerFor } from '../utils/logger'

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
}

/**
 * Readiness probe. Verifies the runtime dependencies that BKOS needs to
 * actually accept work: DB reachable + migrations applied, vault path
 * writable, embedding provider reachable (only when not 'placeholder').
 *
 * Returns 200 with details when every check passes and 503 with the same
 * shape otherwise — clients can rely on the structure either way.
 */
export default defineEventHandler(async (event) => {
  const log = loggerFor(event)
  const config = useRuntimeConfig()
  const checks: CheckResult[] = []

  checks.push(await checkDatabase())
  checks.push(await checkMigrations())
  checks.push(await checkVault(resolve(process.cwd(), config.vaultPath as string)))
  const embeddingProvider = ((config as { embeddingProvider?: string }).embeddingProvider || 'placeholder').toLowerCase()
  if (embeddingProvider !== 'placeholder') {
    checks.push(await checkEmbeddingProvider(embeddingProvider, config))
  }

  const ok = checks.every((check) => check.ok)
  if (!ok) {
    log.warn({ checks }, 'readyz: not ready')
    setResponseStatus(event, 503)
  }
  return { status: ok ? 'ok' : 'degraded', checks }
})

async function checkDatabase(): Promise<CheckResult> {
  try {
    await query('SELECT 1')
    return { name: 'database', ok: true }
  } catch (error) {
    return { name: 'database', ok: false, detail: (error as Error).message }
  }
}

async function checkMigrations(): Promise<CheckResult> {
  try {
    const result = await query<{ count: string }>(`SELECT count(*)::text AS count FROM schema_migrations`)
    const count = Number(result.rows[0]?.count || 0)
    if (count === 0) return { name: 'migrations', ok: false, detail: 'schema_migrations is empty' }
    return { name: 'migrations', ok: true, detail: `${count} applied` }
  } catch (error) {
    return { name: 'migrations', ok: false, detail: (error as Error).message }
  }
}

async function checkVault(path: string): Promise<CheckResult> {
  try {
    await access(path, constants.W_OK)
    return { name: 'vault', ok: true, detail: path }
  } catch (error) {
    return { name: 'vault', ok: false, detail: `${path}: ${(error as Error).message}` }
  }
}

async function checkEmbeddingProvider(provider: string, config: ReturnType<typeof useRuntimeConfig>): Promise<CheckResult> {
  try {
    if (provider === 'ollama') {
      const url = ((config as { ollamaUrl?: string }).ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, '')
      const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) })
      if (!response.ok) throw new Error(`ollama ${response.status}`)
      return { name: 'embedding-provider', ok: true, detail: 'ollama reachable' }
    }
    if (provider === 'openai') {
      const apiKey = (config as { openAIApiKey?: string }).openAIApiKey || ''
      if (!apiKey) throw new Error('OPENAI_API_KEY not set')
      return { name: 'embedding-provider', ok: true, detail: 'openai key present (not pinged)' }
    }
    return { name: 'embedding-provider', ok: true, detail: provider }
  } catch (error) {
    return { name: 'embedding-provider', ok: false, detail: (error as Error).message }
  }
}
