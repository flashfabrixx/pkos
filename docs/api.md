# BKOS REST API (v1)

Versioned public surface under `/api/v1/*`. Authentication is via
`Authorization: Bearer <api-key>` or via the same `bkos_session` cookie
the UI uses.

## Authentication

Generate a key in **Settings → API keys**. The plaintext value is shown
exactly once; the server stores only a scrypt-hashed copy plus the
8-character prefix.

```http
Authorization: Bearer bkos_<prefix>_<secret>
```

Scopes are attached at creation time. Defaults are
`captures:write`, `captures:read`, `entities:read`. `entities:write`
must be requested explicitly.

A key can be revoked at any time; subsequent requests get HTTP 401.

## Endpoints

### `POST /api/v1/captures`

Create a new capture. Body matches the in-app capture form.

```bash
curl -X POST https://bkos.example/api/v1/captures \
  -H "Authorization: Bearer $BKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "voice_note",
    "rawText": "Met with Alice about the embeddings refresh schedule…",
    "capturedAt": "2026-05-16",
    "confidentiality": "private"
  }'
```

`200 OK` returns `{ documentId, status: "processed", extracted }`.

### `GET /api/v1/captures/:id`

Fetch one capture by id. Returns 404 if soft-deleted.

```bash
curl https://bkos.example/api/v1/captures/<uuid> \
  -H "Authorization: Bearer $BKOS_API_KEY"
```

### `GET /api/v1/entities`

List entities, filterable by `type` and free-text `q`. Supports
`offset` + `limit` (default 50, max 200) and returns `hasMore`.

```bash
curl "https://bkos.example/api/v1/entities?type=project&q=embeddings" \
  -H "Authorization: Bearer $BKOS_API_KEY"
```

## Error responses

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 400  | Validation failed (zod error in body)      |
| 401  | Missing / invalid / revoked key or session |
| 403  | Key lacks the required scope               |
| 404  | Resource not found or in trash             |

Every response includes an `x-request-id` header for correlation with
server logs.
