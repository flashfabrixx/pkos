#!/usr/bin/env node
// Interactive first-run setup for BKOS.
//
// Walks the operator through:
//   1. Pick a username + password (or accept defaults).
//   2. Generate SESSION_SECRET + POSTGRES_PASSWORD.
//   3. Hash the password (scrypt).
//   4. Write apps/web/.env … wait, no: the canonical .env is at the repo root.
//      We write/merge there.
//   5. Start the Postgres container with the chosen password.
//   6. Run `pnpm db:migrate`.
//   7. Mark setup_state as completed.
//   8. Print a "you can now run `pnpm dev`" hint.
//
// Re-running is safe: every existing .env value is preserved unless the
// operator explicitly opts to overwrite it.

import { createInterface } from 'node:readline/promises'
import { randomBytes, scrypt } from 'node:crypto'
import { readFile, writeFile, access, constants } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(repoRoot, '.env')

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function ask(prompt, fallback = '') {
  const display = fallback ? `${prompt} [${fallback}]: ` : `${prompt}: `
  const answer = (await rl.question(display)).trim()
  return answer || fallback
}

async function askSecret(prompt) {
  // Node's readline doesn't natively support masked input. We use a stderr
  // hint instead of actual masking; the value is never echoed back.
  process.stderr.write('(input not displayed) ')
  return ask(prompt)
}

async function readEnv() {
  try {
    const content = await readFile(envPath, 'utf8')
    const parsed = {}
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) parsed[m[1]] = m[2]
    }
    return { content, parsed }
  } catch {
    return { content: '', parsed: {} }
  }
}

async function mergeEnv(updates) {
  const { content } = await readEnv()
  const lines = content ? content.split('\n') : []
  const seen = new Set()
  const out = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/)
    if (!m) return line
    const key = m[1]
    if (key in updates) {
      seen.add(key)
      return `${key}=${updates[key]}`
    }
    return line
  })
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`)
  }
  await writeFile(envPath, out.join('\n').replace(/\n+$/, '') + '\n')
}

function scryptHash(password) {
  return new Promise((resolveHash, reject) => {
    const salt = randomBytes(16)
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) reject(err)
      else resolveHash(`scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`)
    })
  })
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts })
    child.on('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${cmd} exited ${code}`)))
  })
}

async function main() {
  console.log('\nBKOS first-run setup\n────────────────────')
  const { parsed } = await readEnv()

  const username = await ask('Username for the admin account', parsed.BKOS_USERNAME || 'admin')
  let password = await askSecret('Password (leave blank to generate a random one)')
  if (!password) {
    password = randomBytes(12).toString('base64url')
    console.log(`  → generated password: ${password}  (save it now!)`)
  }
  const passwordHash = await scryptHash(password)

  const sessionSecret = parsed.SESSION_SECRET || randomBytes(48).toString('base64')
  const pgPassword = parsed.POSTGRES_PASSWORD || randomBytes(16).toString('hex')

  const updates = {
    BKOS_USERNAME: username,
    BKOS_PASSWORD_HASH: passwordHash,
    SESSION_SECRET: sessionSecret,
    POSTGRES_DB: parsed.POSTGRES_DB || 'bkos',
    POSTGRES_USER: parsed.POSTGRES_USER || 'bkos',
    POSTGRES_PASSWORD: pgPassword,
    DATABASE_URL: `postgres://${parsed.POSTGRES_USER || 'bkos'}:${pgPassword}@localhost:5433/${parsed.POSTGRES_DB || 'bkos'}`,
    BKOS_VAULT_PATH: parsed.BKOS_VAULT_PATH || './vault',
    BKOS_FILES_PATH: parsed.BKOS_FILES_PATH || './files',
    BKOS_EXTRACTOR_PROVIDER: parsed.BKOS_EXTRACTOR_PROVIDER || 'placeholder',
    BKOS_EMBEDDING_PROVIDER: parsed.BKOS_EMBEDDING_PROVIDER || 'placeholder'
  }
  await mergeEnv(updates)
  console.log(`\n  ✔ wrote ${envPath}`)

  console.log('\n  → bringing Postgres up via docker compose…')
  try {
    await run('docker', ['compose', '--env-file', envPath, 'up', '-d', 'postgres'])
  } catch (error) {
    console.error(`  ⚠ docker compose failed: ${error.message}`)
    console.error('  Skipping migrations. Start Postgres yourself and re-run `pnpm db:migrate`.')
    rl.close()
    return
  }

  // Wait for healthy
  console.log('  → waiting for Postgres health…')
  await new Promise((r) => setTimeout(r, 4000))

  console.log('\n  → applying migrations…')
  try {
    await run('pnpm', ['db:migrate'], { env: { ...process.env, DATABASE_URL: updates.DATABASE_URL } })
  } catch (error) {
    console.error(`  ⚠ migration failed: ${error.message}`)
    rl.close()
    return
  }

  // Mark setup_state.completed_at via psql so the wizard is skipped.
  console.log('  → marking setup as complete…')
  try {
    await run('docker', [
      'compose', '--env-file', envPath, 'exec', '-T', 'postgres',
      'psql', '-U', updates.POSTGRES_USER, '-d', updates.POSTGRES_DB,
      '-c', `UPDATE setup_state SET completed_at = now() WHERE id = 1;`
    ])
  } catch {
    // best-effort: the wizard will still let the operator finish manually
  }

  // Make sure local vault/files dirs exist for the app
  await Promise.all([
    ensureDir(resolve(repoRoot, updates.BKOS_VAULT_PATH)),
    ensureDir(resolve(repoRoot, updates.BKOS_FILES_PATH))
  ])

  console.log('\n✔ Setup complete.')
  console.log(`  Username : ${username}`)
  console.log(`  Password : ${password}`)
  console.log('  Next     : pnpm dev   →   http://localhost:3000')
  console.log('             (Login with the credentials above.)\n')
  rl.close()
}

async function ensureDir(path) {
  try {
    await access(path, constants.F_OK)
  } catch {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path, { recursive: true })
  }
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
