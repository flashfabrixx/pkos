import { randomBytes, scrypt } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

export interface NuxtServerContext {
  baseUrl: string
  username: string
  password: string
  stop: () => Promise<void>
}

function hashPasswordSync(plaintext: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const salt = randomBytes(16)
    scrypt(plaintext, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err)
      resolveHash(`scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`)
    })
  })
}

/**
 * Boot a real Nuxt dev server against the given DATABASE_URL with a
 * known username/password pair. Returns the public base URL plus a
 * teardown function for `afterAll`.
 *
 * Skip-friendly: tests that need this should also call `beforeAll`
 * inside a `describe.skipIf(...)` block when running under restricted
 * CI environments without Docker.
 */
export async function startNuxtServer(databaseUrl: string): Promise<NuxtServerContext> {
  const username = 'tester'
  const password = randomBytes(12).toString('hex')
  const passwordHash = await hashPasswordSync(password)
  const sessionSecret = randomBytes(48).toString('base64')
  const port = 3500 + Math.floor(Math.random() * 500)

  const child: ChildProcessWithoutNullStreams = spawn('./node_modules/.bin/nuxt', [
    'dev', '--port', String(port), '--host', '127.0.0.1'
  ], {
    cwd: resolve(repoRoot, 'apps/web'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      LOG_LEVEL: 'warn',
      PKOS_USERNAME: username,
      PKOS_PASSWORD_HASH: passwordHash,
      SESSION_SECRET: sessionSecret,
      DATABASE_URL: databaseUrl,
      PKOS_VAULT_PATH: '/tmp/pkos-test-vault',
      PKOS_FILES_PATH: '/tmp/pkos-test-files',
      PKOS_EXTRACTOR_PROVIDER: 'placeholder',
      PKOS_EMBEDDING_PROVIDER: 'placeholder'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const captured: string[] = []
  const sink = (chunk: Buffer) => { captured.push(chunk.toString('utf8')) }
  child.stdout.on('data', sink)
  child.stderr.on('data', sink)

  const baseUrl = `http://127.0.0.1:${port}`
  // Nuxt dev boot on CI runners can take 60-150s once the suite grows;
  // give the readiness probe a generous ceiling so single-fork serial
  // boots don't flake.
  const deadline = Date.now() + 240_000
  let ready = false
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/api/healthz`)
      if (r.ok) { ready = true; break }
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  if (!ready) {
    child.kill('SIGTERM')
    const tail = captured.join('').split('\n').slice(-30).join('\n')
    throw new Error(`Nuxt dev server didn't become healthy on ${baseUrl}:\n${tail}`)
  }

  return {
    baseUrl,
    username,
    password,
    async stop() {
      child.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 500))
      if (!child.killed) child.kill('SIGKILL')
    }
  }
}
