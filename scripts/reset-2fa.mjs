#!/usr/bin/env node
// Disable 2FA from the host shell. Use when the authenticator device is
// lost and no backup codes are left. Run on the same server that hosts
// the database with the .env loaded.

import pg from 'pg'
import { readFileSync, existsSync } from 'node:fs'

const envPath = process.argv[2] || '.env'
if (!existsSync(envPath)) {
  console.error(`No .env file at ${envPath}. Pass the path as the first argument if needed.`)
  process.exit(1)
}

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set in the env.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()
try {
  const before = await client.query(`SELECT enabled_at FROM auth_config WHERE id = 1`)
  if (!before.rows[0]?.enabled_at) {
    console.log('Two-factor authentication is not currently enabled. Nothing to do.')
    process.exit(0)
  }
  await client.query(`UPDATE auth_config
                      SET totp_secret_encrypted = NULL,
                          backup_codes = '[]'::jsonb,
                          enabled_at = NULL,
                          session_min_iat = now(),
                          updated_at = now()
                      WHERE id = 1`)
  console.log('Two-factor authentication has been disabled. All sessions are revoked — sign in again with your password.')
} finally {
  await client.end()
}
