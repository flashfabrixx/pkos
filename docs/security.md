# Security

BKOS is built to be self-hosted on a small VM, behind a reverse proxy with
TLS. The defaults are designed to refuse to start in unsafe configurations
so first-time deployers are nudged into safe choices.

## Threat model

- **Single-user** account, password-protected, optional second factor via TOTP.
- A long-lived session cookie (14 days, HttpOnly, SameSite=Lax, signed HMAC-SHA256).
- The Postgres database is the source of truth for documents, comments, and
  the auth-config singleton. TOTP secrets are encrypted at rest with the
  session secret (AES-256-GCM).
- The default deployment topology: reverse proxy with TLS terminating in
  front of Nitro, Postgres bound to loopback, both running on the same VM.

## Required configuration

Every value here is required for the server to boot in production.

| Variable | Purpose |
| --- | --- |
| `BKOS_USERNAME` | Login name |
| `BKOS_PASSWORD_HASH` | Hashed password (generate with `pnpm setup:password`) |
| `SESSION_SECRET` | Cookie + AES key derivation. **At least 32 chars.** `openssl rand -base64 48` |
| `POSTGRES_PASSWORD` | DB password used by both compose and the app |
| `DATABASE_URL` | Full Postgres connection string |

The legacy `BKOS_PASSWORD` (plaintext) is accepted as a one-time bootstrap
fallback. The server prints a security warning on every startup until you
replace it with `BKOS_PASSWORD_HASH`.

## Generating credentials

```bash
# Password hash (asks twice, prints the hash for your .env)
pnpm setup:password

# Session secret
openssl rand -base64 48
```

## Two-factor authentication

Enable from `/settings` after logging in:

1. Click **Enable two-factor**.
2. Scan the otpauth URI with your authenticator app (1Password, Authy, Google
   Authenticator, etc.) or paste the secret manually.
3. Enter the current 6-digit code to confirm.
4. **Save the backup codes** that follow — they are shown once.

After 2FA is enabled, login becomes a two-step flow: password, then
authenticator code. Backup codes can be used in place of the code, each
one good for a single login.

## Recovery scenarios

### Lost or forgotten password

1. SSH to the server.
2. `pnpm setup:password` — generates a new `BKOS_PASSWORD_HASH`.
3. Replace the old hash in `.env`.
4. Restart the service (`pm2 restart bkos` or `systemctl restart bkos`).
5. All existing sessions are still valid until they expire. To revoke
   them now, also bump `SESSION_SECRET` (this invalidates all cookies).

### Lost authenticator app, no backup codes left

1. SSH to the server.
2. `node scripts/reset-2fa.mjs` — disables TOTP, revokes existing sessions.
3. Log in with your password.
4. Re-enable 2FA from `/settings` if you want.

### Lost `SESSION_SECRET`

Generate a new one and put it in `.env`. All existing sessions become
invalid; users sign in again.

### Lost the database

The vault directory (`BKOS_VAULT_PATH`, default `./vault`) contains a
human-readable markdown copy of every captured document, so you can rebuild
the knowledge base from a vault backup. Entity relationships, comments and
action items live only in Postgres, though — take regular `pg_dump` backups.

## Built-in defenses

- **Password storage**: scrypt (N=16384, r=8, p=1), 16-byte salt, 64-byte
  derived key. Constant-time compare for verification.
- **Session secret**: required at startup, minimum 32 chars, fails to boot
  on common placeholder values.
- **Sessions**: HMAC-SHA256 signed, HttpOnly, SameSite=Lax, Secure in
  production. Server-side revocation checkpoint (`session_min_iat`) lets
  logout invalidate ALL existing tokens, not just the current cookie.
- **2FA**: TOTP (RFC 6238) with ±1 step tolerance. Secret encrypted with
  AES-256-GCM, key derived from `SESSION_SECRET`. Ten single-use backup
  codes generated at enrollment, stored as SHA-256 hashes.
- **Login rate limit**: 5 failed attempts per IP locks login for 5 minutes
  (in-memory; reset on success).
- **CSRF**: Origin / Referer header check on every non-safe request. Same
  origin required.
- **Security headers**: CSP, X-Frame-Options=DENY, Referrer-Policy,
  Permissions-Policy on every response. HSTS in production.
- **Error responses**: in production, 5xx bodies strip stack traces and the
  status message is normalized to `Internal server error`.
- **Database**: Postgres bound to `127.0.0.1` by default. To expose on a
  LAN, update `docker-compose.yml` after putting a firewall in front.
- **TOTP secret at rest**: encrypted with AES-256-GCM keyed off the session
  secret. Reading the database alone is not enough to forge codes.

## What is intentionally NOT included (yet)

- Multi-user / RBAC.
- WebAuthn / Passkeys (a stronger second factor than TOTP, planned for v2).
- Audit log of state-changing operations.
- IP allow-listing.

If you need any of these for a deployment, file an issue describing the
threat model.
