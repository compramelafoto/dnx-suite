# 10 — Split Consent sandbox flow

## Endpoints

| Method | Path | Etapa 03 |
|---|---|---|
| POST | `/v1/split-consent` | sandbox write |
| GET | `/v1/split-consent` | read (sandbox token) |
| PATCH | `/v1/split-consent/{receiver_id}` | sandbox cancel |

## Body (create)

```json
{ "invites": [{ "seller_email": "NICKNAME@testuser.com" }] }
```

Headers:

- `Authorization: Bearer TEST-…`
- `X-Idempotency-Key: <uuid-v4>`
- `x-test-token: true`
- optional `x-test-status: ACTIVE|…` (sandbox force)

## Response

`{ succeeded: [...], failed: [...] }` — HTTP 201 or 207 partial.

Statuses: `PENDING | ACTIVE | REJECTED | CANCELED | EXPIRED`.

## DNX mapping

Persist later (Etapa 04+): `receiver_id` ↔ internal Recipient.  
Never accept partner emails from untrusted browser without server authorization.

## Cancel

`PATCH` body `{ "status": "CANCELED" }` — primary may cancel PENDING/ACTIVE.
