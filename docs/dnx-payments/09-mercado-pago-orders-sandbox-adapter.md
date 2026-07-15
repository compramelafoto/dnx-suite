# 09 — Mercado Pago Orders sandbox adapter

## Scope (Etapa 03)

Functional **sandbox-only** adapter for Orders API Split 1:N inside `@repo/payments`.

| Included | Excluded |
|---|---|
| HTTP client + guards | Production writes |
| Split Consent adapter | Prisma persistence |
| Orders create/get | CLF Preferences cutover |
| Validators / mappers | Refunds execution |
| Commands + in-memory ports | Real money / prod webhooks |
| MCP sandbox tools | PDF privado in repo |

## Package layout

`packages/payments/src/providers/mercado-pago/`

- `client/` — config, HTTP, RFC 7807
- `split-consent/` — `/v1/split-consent`
- `orders/` — `/v1/orders`
- `refunds/` — typed placeholders (`NotImplementedForSafetyError`)
- `webhooks/` — Orders_v1 parser (no product routes)
- `testing/` — fixtures + fake client

## Safety

Writes require **all** of:

1. `environment: "sandbox"`
2. Access token prefix `TEST-`
3. Header `x-test-token: true`
4. Idempotency key (UUID v4 for consent)
5. `MercadoPagoProductionWriteBlockedError` otherwise

Owner `user_id` is injected **server-side** via `MercadoPagoOrdersAdapterOptions.ownerUserId`.

## WAITING_MP_CONFIRMATION

Fee allocation · Seller Primary product decision · taxes · settlements/payouts.

## Sandbox real

No TEST credentials were available in this workspace → status **`COMPLETE_PENDING_SANDBOX_CREDENTIALS`**.
