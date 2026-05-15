import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { BackupCode } from './auth-config'

const CODE_COUNT = 10

export interface GeneratedBackupCodes {
  plain: string[]
  stored: BackupCode[]
}

export function generateBackupCodes(): GeneratedBackupCodes {
  const plain: string[] = []
  const stored: BackupCode[] = []
  for (let i = 0; i < CODE_COUNT; i++) {
    const code = randomBytes(5).toString('hex') // 10 chars hex
    plain.push(code)
    stored.push({ hash: hashCode(code), used_at: null })
  }
  return { plain, stored }
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase()).digest('hex')
}

export function tryConsume(codes: BackupCode[], submitted: string): { ok: boolean, updated: BackupCode[] } {
  const target = hashCode(submitted)
  const updated = codes.map((c) => ({ ...c }))
  for (const entry of updated) {
    if (entry.used_at) continue
    if (timingSafeEqual(Buffer.from(entry.hash), Buffer.from(target))) {
      entry.used_at = new Date().toISOString()
      return { ok: true, updated }
    }
  }
  return { ok: false, updated: codes }
}
