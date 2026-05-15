import { requireAuth } from '../../../utils/auth'
import { readAuthConfig } from '../../../utils/auth-config'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const cfg = await readAuthConfig()
  return {
    enabled: Boolean(cfg.enabled_at && cfg.totp_secret_encrypted),
    enabled_at: cfg.enabled_at,
    backup_codes_remaining: cfg.backup_codes.filter((c) => !c.used_at).length,
    backup_codes_total: cfg.backup_codes.length
  }
})
