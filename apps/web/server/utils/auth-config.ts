import { query } from './db'

interface AuthConfigRow {
  id: number
  totp_secret_encrypted: string | null
  backup_codes: BackupCode[]
  enabled_at: string | null
}

export interface BackupCode {
  hash: string // sha256 of the code, hex
  used_at: string | null
}

export async function readAuthConfig(): Promise<AuthConfigRow> {
  const result = await query<AuthConfigRow>(
    `SELECT id, totp_secret_encrypted, backup_codes, enabled_at FROM auth_config WHERE id = 1`
  )
  const row = result.rows[0]
  if (row) return row
  // Self-heal if migration ran but the row was wiped.
  await query(`INSERT INTO auth_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`)
  const second = await query<AuthConfigRow>(
    `SELECT id, totp_secret_encrypted, backup_codes, enabled_at FROM auth_config WHERE id = 1`
  )
  return second.rows[0]!
}

export async function isTotpEnabled(): Promise<boolean> {
  const cfg = await readAuthConfig()
  return Boolean(cfg.enabled_at && cfg.totp_secret_encrypted)
}

export async function persistTotp(secretEncrypted: string, backupCodes: BackupCode[]) {
  await query(
    `UPDATE auth_config
     SET totp_secret_encrypted = $1,
         backup_codes = $2::jsonb,
         enabled_at = now(),
         updated_at = now()
     WHERE id = 1`,
    [secretEncrypted, JSON.stringify(backupCodes)]
  )
}

export async function persistBackupCodes(backupCodes: BackupCode[]) {
  await query(
    `UPDATE auth_config SET backup_codes = $1::jsonb, updated_at = now() WHERE id = 1`,
    [JSON.stringify(backupCodes)]
  )
}

export async function clearTotp() {
  await query(
    `UPDATE auth_config
     SET totp_secret_encrypted = NULL,
         backup_codes = '[]'::jsonb,
         enabled_at = NULL,
         updated_at = now()
     WHERE id = 1`
  )
}
