# Email → BKOS

BKOS can ingest unread mail from any IMAP-reachable inbox and turn each
message into a capture. The flow is:

1. A scheduled task (every 5 minutes by default) opens the configured
   INBOX, pulls every UNSEEN message and marks it Seen on success.
2. Each message is deduplicated by `Message-Id`, filtered against the
   optional `MAIL_FROM_ALLOW` allow-list, and ingested through the same
   pipeline that the web UI uses.
3. Attachments become rows in `document_attachments`. Text extraction
   runs server-side via the B4 stack (`pdfjs-dist`, `mammoth`).

## Environment

```env
MAIL_HOST=imap.example.com
MAIL_PORT=993
MAIL_USER=bkos@example.com
MAIL_PASSWORD=app-password
MAIL_SECURE=true
MAIL_FROM_ALLOW=marcel@example.com,team@example.com
```

`MAIL_SECURE` defaults to `true` (TLS). Plaintext IMAP is supported by
setting `MAIL_SECURE=false`, but never use that across the public
internet.

## Provider sketches

### Self-hosted with [Postal](https://postal.atech.media/)

Set up Postal in a private network. Create a mailbox `bkos@yourdomain`,
connect BKOS via IMAP (typically port 993 with TLS). Postal's
incoming-route DSL can forward only specific addresses into the BKOS
mailbox — useful if you also want to email yourself colleagues' replies
without leaking everything.

### Self-hosted with [Haraka](https://haraka.github.io/)

Use Haraka as the SMTP receiver and have it deliver into a Dovecot
mailbox; BKOS then polls Dovecot via IMAP. Suitable if you already run
postfix/dovecot. The same `MAIL_FROM_ALLOW` env shapes who can land
captures.

### Cloud (Gmail / Fastmail / Outlook)

Provision an app password (Gmail: Security → App passwords; Fastmail:
Settings → Password & security → Mail/IMAP/SMTP passwords). Point BKOS
at the provider's IMAP host. For Gmail use `imap.gmail.com:993` and the
Gmail account email as `MAIL_USER`. Note that consumer-grade Gmail
rate-limits aggressive polling — every 5 minutes is well under the cap.

## Operational notes

- The scheduled task is a no-op when `MAIL_HOST` is unset, so leaving
  these variables blank in `.env` is fine for installs that don't need
  the integration.
- Failures are logged with `component=email`. Look for `imap poll cycle`
  and `imap poll failed` in your aggregator.
- The dedupe log lives in `email_ingest_log` (migration `0016`). Even if
  you delete a capture, the message-id stays in the log so the poll
  doesn't re-create it.
