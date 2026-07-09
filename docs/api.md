# PKOS REST API (v1)

Versioned public surface under `/api/v1/*`. Authentication is via
`Authorization: Bearer <api-key>` or via the same `pkos_session` cookie
the UI uses.

## Authentication

Generate a key in **Settings → API keys**. The plaintext value is shown
exactly once; the server stores only a scrypt-hashed copy plus the
8-character prefix.

```http
Authorization: Bearer pkos_<prefix>_<secret>
```

Scopes are attached at creation time. Defaults are
`captures:write`, `captures:read`, `entities:read`. The remaining
scopes — `entities:write`, `search:read`, `chat:read` — must be
requested explicitly.

A key can be revoked at any time; subsequent requests get HTTP 401.

Requests that authenticate with a Bearer key are exempt from the CSRF
Origin/Referer check, so server-to-server clients (curl, n8n, cron
jobs) can send state-changing requests without browser headers.
Cookie-authenticated requests keep the CSRF requirement.

## Endpoints

### `POST /api/v1/captures`

Create a new capture. Body matches the in-app capture form.

```bash
curl -X POST https://pkos.example/api/v1/captures \
  -H "Authorization: Bearer $PKOS_API_KEY" \
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
curl https://pkos.example/api/v1/captures/<uuid> \
  -H "Authorization: Bearer $PKOS_API_KEY"
```

### `GET /api/v1/entities`

List entities, filterable by `type` and free-text `q`. Supports
`offset` + `limit` (default 50, max 200) and returns `hasMore`.

```bash
curl "https://pkos.example/api/v1/entities?type=project&q=embeddings" \
  -H "Authorization: Bearer $PKOS_API_KEY"
```

### `GET /api/v1/search`

Hybrid search across documents and chunks. Requires scope `search:read`.
When an embedding provider is configured, scoring combines cosine
similarity and BM25; otherwise it degrades to lexical-only and reports
`mode: "lexical"`.

Query parameters: `q` (required), `kinds` (comma-separated source types),
`lang` (ISO 639-1), `from` / `to` (yyyy-mm-dd `captured_at` range),
`limit` (1–50, default 20).

```bash
curl "https://pkos.example/api/v1/search?q=embeddings%20refresh&kinds=voice_note,meeting" \
  -H "Authorization: Bearer $PKOS_API_KEY"
```

Response:

```json
{
  "mode": "hybrid",
  "results": [
    {
      "document_id": "…",
      "title": "Embeddings refresh schedule",
      "captured_at": "2026-05-16",
      "excerpt": "…",
      "score": 0.81
    }
  ],
  "entities": [{ "id": "…", "type": "project", "name": "Embeddings" }]
}
```

### `GET /api/v1/people`

People list (entities of type `person`) with document counts and open
action counts. Requires scope `entities:read`.

Query parameters: `q` (substring match on name), `limit` (1–200,
default 50), `offset` (default 0). Returns `hasMore`.

```bash
curl "https://pkos.example/api/v1/people?q=alice" \
  -H "Authorization: Bearer $PKOS_API_KEY"
```

### `POST /api/v1/chat`

Retrieval-augmented answer. Runs the hybrid search internally, drafts
an answer with the configured LLM provider, and returns the supporting
sources. Requires scope `chat:read`.

```bash
curl -X POST https://pkos.example/api/v1/chat \
  -H "Authorization: Bearer $PKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What did Alice say about the embeddings refresh?",
    "topK": 6
  }'
```

Body fields:

| Field      | Type     | Notes                                             |
| ---------- | -------- | ------------------------------------------------- |
| `question` | string   | Required, 1–2000 chars                            |
| `history`  | array    | Optional prior `{role,content}` turns (max 20)    |
| `topK`     | integer  | 1–20, default 8                                   |
| `filters`  | object   | Same shape as `/api/v1/search` filters            |

Response: `{ mode, answer, provider, sources[] }`. When no LLM provider
is configured (`extractorProvider: placeholder` or missing API key),
`answer` is a deterministic stub and `provider` is `"placeholder"` —
clients should fall back to rendering `sources` directly.

## Error responses

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 400  | Validation failed (zod error in body)      |
| 401  | Missing / invalid / revoked key or session |
| 403  | Key lacks the required scope               |
| 404  | Resource not found or in trash             |

Every response includes an `x-request-id` header for correlation with
server logs.
