# 14 — Smoke sandbox MP Split (Etapa 04)

## Estado Bloque A

Sin credenciales TEST válidas en el entorno de desarrollo, el smoke real queda:

**`BLOCKED_BY_SANDBOX_CREDENTIALS`**

No se usan tokens `APP_USR-`, ni vendedores/compradores reales, ni Production.

## Preflight

CLI:

```bash
pnpm --filter @repo/payments smoke:mp-split-sandbox -- --dry-run
pnpm --filter @repo/payments smoke:mp-split-sandbox -- --confirm
```

Estados:

| Status | Significado |
|---|---|
| `READY` | Checklist OK |
| `MISSING_TEST_TOKEN` | Falta `MERCADOPAGO_TEST_ACCESS_TOKEN` |
| `INVALID_TEST_OWNER` | Owner no numérico |
| `INVALID_TEST_PARTNER` | Partner no `TESTUSER…@testuser.com` |
| `PRODUCTION_TOKEN_REJECTED` | Token `APP_USR-` o env production |
| `CONFIRMATION_REQUIRED` | Falta `--confirm` |

## Variables (nombres)

- `MERCADOPAGO_TEST_ACCESS_TOKEN` (`TEST-…`)
- `MERCADOPAGO_TEST_PUBLIC_KEY`
- `MERCADOPAGO_TEST_OWNER_USER_ID`
- `MERCADOPAGO_TEST_PARTNER_EMAIL`
- `MERCADOPAGO_TEST_DEVICE_ID`
- `MERCADOPAGO_TEST_PAYMENT_TOKEN`

Nunca imprimir valores.

## Payment token

Obtener con **MercadoPago.js** + Public Key TEST + tarjeta de prueba oficial.

No enviar PAN/CVV al backend.

Si falta token: `BLOCKED_BY_TEST_PAYMENT_TOKEN`.

## Flujo objetivo (cuando READY)

1. Consent TEST (`x-test-token`, `x-test-status: ACTIVE`)
2. Distribution 70/30 controlada
3. Create order Split TEST
4. GET canónico + clasificación MATCHED / mismatch
5. Idempotencia same/different payload
6. Errores controlados sin abuso
7. Cleanup consentimiento solo si creado por el smoke

## Orders 1:N staging Clickatón (10D3I-F)

Además del smoke 70/30, existe CLI controlada 3-way **34/33/33**:

```bash
pnpm --filter @repo/payments orders-1n:activate-staging -- --preflight
pnpm --filter @repo/payments orders-1n:activate-staging -- --dry-run
pnpm --filter @repo/payments orders-1n:activate-staging -- \
  --create-order --confirm-staging --confirm-orders-test
pnpm --filter @repo/payments orders-1n:activate-staging -- --rollback-flag-off
```

Requiere receivers #1/#2 ACTIVE, device id, payment token fresco, y host/db staging confirmados. Flag final siempre OFF. Doc: `docs/clickaton/ORDERS_1N_STAGING_ACTIVATION_10D3I_F.md`.
