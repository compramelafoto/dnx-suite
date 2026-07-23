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

## Sandbox real (10D3I-F)

Orders 1:N TEST validado en staging Clickatón (`ep-divine-smoke-av8hmt7s*` / `clickaton_staging`):

- Flag temporal `DNX_MP_ORDERS_1N_STAGING_ENABLED` (default off; CLI fuerza off al finalizar)
- `paymentToken` + `payment_method.id` (default `visa`) + `payer.email` + `x-meli-session-id`
- Split percentage 34/33/33 (owner + 2 receivers TEST)
- CLI: `pnpm --filter @repo/payments orders-1n:activate-staging`
- Doc: `docs/clickaton/ORDERS_1N_STAGING_ACTIVATION_10D3I_F.md`

Checkout Pro / Preferences de Clickatón permanece intacto.

### Webhook observe (10D3I-G)

- Parser `type=order` + flag observe independiente del create
- Pipeline `observeOrdersWebhook` (firma → inbox → GET reconcile → audit)
- Clickatón route ignora Orders si observe=OFF; no confirma inscripciones
- CLI: `pnpm --filter @repo/payments orders-1n:observe-staging`
- Doc: `docs/clickaton/ORDERS_1N_WEBHOOK_RECONCILIATION_10D3I_G.md`
