# 11 — Orders sandbox safety & idempotency

## Create order

`POST /v1/orders` with:

- `config.split_rules.amount_type`: `fixed` | `percentage`
- `splits[]`: owner (`user_id` string) + partners (`receiver_id` UUID)
- Headers: `x-idempotency-key`, `x-meli-session-id` (Device ID), `x-test-token`

Approval is **never** inferred from HTTP 201 alone. Canonical check:

- order `status=processed` + `status_detail=accredited` (or GET verification)

Unknown provider statuses map to `UNKNOWN:…` and must not unlock fulfillment.

## Idempotency

Port `IdempotencyStore` + in-memory impl for tests:

- same key + same payload hash → replay
- same key + different hash → conflict
- retries keep the **same** idempotency key

### Staging evidence (10D3I-F)

CLI `orders-1n:activate-staging --idempotency-replay` contra sandbox:

- same key + same payload → misma orden (`sameOrder=true`)
- same key + external_reference distinto → bloqueo/conflicto (`conflictBlocked=true`)
- Snapshot 10D3I-E intacto (no mutado por create/replay)

### Webhook observe + reconcile (10D3I-G)

CLI `orders-1n:observe-staging`:

- firma oficial + `live_mode=false` obligatorios en sandbox
- inbox idempotente (`processed` → `duplicate`)
- reconcile claim vs `GET /v1/orders/{id}`
- snapshot E asociado read-only (`intact=true`)
- flag observe `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` default/final **off**
- doc: `docs/clickaton/ORDERS_1N_WEBHOOK_RECONCILIATION_10D3I_G.md`

## Money

Minor units → decimal strings via `moneyToMercadoPagoAmount` (no float).

## Refunds

Blocked: `NotImplementedForSafetyError` until fee/chargeback rules confirmed (`WAITING_MP_CONFIRMATION`).
