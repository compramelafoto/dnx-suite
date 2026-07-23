# CLICKATÓN — ETAPA 10D3I-G — OBSERVABILIDAD, WEBHOOKS Y RECONCILIACIÓN DE ORDERS 1:N TEST

**Fecha:** 2026-07-23
**Rama:** `migration-legacy-clf-to-monorepo`
**HEAD base:** `b8b7c46` (10D3I-F)
**Veredicto:** **VALIDADO — WEBHOOK Y RECONCILIACIÓN ORDERS 1:N TEST OK**

## Objetivo

Cerrar el circuito operativo de la orden sandbox de F (sin recrear el pago):

1. Ingest firmado de webhook Orders (`live_mode=false`)
2. Idempotencia de inbox
3. Reconciliación contra `GET /v1/orders/{id}`
4. Asociación read-only al snapshot 10D3I-E
5. Detección de mismatches
6. Reintentos controlados
7. Auditoría / contadores sin secretos
8. Flags create + observe en **OFF** al finalizar

## Preflight

| Check | Resultado |
|---|---|
| Staging | `ep-divine-smoke-av8hmt7s*` / `clickaton_staging` |
| Orden F | `ORDTST01…` presente (`.local/audit-10d3i-f/last_order_state.json`) |
| Snapshot E | `ods_d16a37…` / hash `ba5dedcc…` intacto |
| Create flag | OFF |
| Observe flag | OFF (default) |
| Webhook secret TEST | presente (`MERCADOPAGO_TEST_WEBHOOK_SECRET`) |

## Flags

| Flag | Rol | Default / final |
|---|---|---|
| `DNX_MP_ORDERS_1N_STAGING_ENABLED` | create real Orders | **OFF** |
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | observe HTTP Orders | **OFF** |

Observe HTTP en Clickatón (`/api/webhooks/dnx-payments`) solo actúa si observe=ON. Con observe=OFF, `type=order` se ignora (200) sin efectos de inscripción.

## Webhook

### Clasificación de entrega

| Clase | Estado en G |
|---|---|
| `HTTP_DELIVERED_FROM_MP` | Cableado listo; requiere URL pública + secret en panel MP |
| `SIGNED_REPLAY_OF_SANDBOX_ORDER` | **Validado** — envelope firmado con order id real de F + GET live |

No se usó secreto productivo. Manifest oficial `id;request-id;ts` + HMAC-SHA256.

### Validaciones

- Firma inválida → DENIED / alert `SIGNATURE_FAIL`
- `live_mode=true` en sandbox → `LIVE_MODE_FORBIDDEN`
- `live_mode` ausente en sandbox → `LIVE_MODE_UNDECLARED`
- Idempotencia: mismo `eventId` → `duplicate` (sin re-efectos)

## Reconciliación GET

Orden F:

| Campo | Valor |
|---|---|
| status | `PROCESSED_ACCREDITED` |
| status_detail | `accredited` |
| totalMinor | `100000` |
| splits | `34.00` / `33.00` / `33.00` |
| recipients | 3 |
| external_reference | `clickaton-10d3i-f-1784777000491` |

Webhook claim vs GET: sin mismatches.

## Snapshot

Asociación read-only por `amount_and_bps` al snapshot E:

- id `ods_d16a37…`
- hash `ba5dedcc…`
- bps 3400/3300/3300
- **intact=true** (no mutado)

## Reintentos

Simulación controlada: primer GET falla → `GET_ORDER_FAILED` + `RETRY_SCHEDULED`; reintento con GET OK → `processed`. Inbox persistence marca FAILED / DEAD_LETTER (≥5 attempts).

## Observabilidad

Contadores secret-free: received, signatureOk/Fail, liveModeRejected, duplicates, processed, mismatches, retries, deadLetters + alert codes.

Evidencia: `.local/audit-10d3i-g/` (gitignored).

## CLI

```bash
pnpm --filter @repo/payments orders-1n:observe-staging -- --preflight
pnpm --filter @repo/payments orders-1n:observe-staging -- \
  --reconcile-get --confirm-staging --confirm-orders-test
pnpm --filter @repo/payments orders-1n:observe-staging -- \
  --ingest-signed-replay --confirm-staging --confirm-orders-test
pnpm --filter @repo/payments orders-1n:observe-staging -- \
  --idempotency-replay --confirm-staging --confirm-orders-test
pnpm --filter @repo/payments orders-1n:observe-staging -- --rollback-flags-off
```

## Código

| Pieza | Path |
|---|---|
| Observe pipeline | `packages/payments/src/application/services/orders-1n-observe/` |
| Orders notification parser | `…/webhooks/orders-notification.ts` |
| TEST sign fixture | `…/webhooks/sign-test-fixture.ts` |
| Observe flag | `…/orders/orders-1n-observe-flag.ts` |
| CLI | `packages/payments/src/cli/observe-orders-1n-staging.ts` |
| Clickatón HTTP branch | `apps/clickaton/.../durable-dnx-payments-client.ts` + webhook route |

## Seguridad

- Sin tokens / device / receivers completos en audit
- Sin push
- Sin cuentas MP reales
- Sin activar create Orders en runtime Clickatón
- Checkout Preferences intacto

## Limitaciones

- Entrega HTTP real desde MP al edge público pendiente de configurar notification URL + secret en panel TEST
- Observe HTTP en staging app queda OFF por defecto (on solo ventana controlada)
- No hay PagerDuty; alertas = contadores + audit actions

## Caso Rodrigo

- cuenta real consultada: **no**
- cuenta real conectada: **no**
- receiver TEST: **sí** (orden F)
- migración real pendiente: **sí**

## Seguimiento 10D3I-H

Checkout inscripción + fulfillment desde observe Orders. Ver:

`docs/clickaton/REGISTRATION_CHECKOUT_DNX_PAYMENTS_STAGING_10D3I_H.md`

## Seguimiento 10D3I-I0

Gobernanza onboarding socios MP reales (sin OAuth):
`docs/clickaton/MERCADO_PAGO_PARTNERS_PRODUCTION_ONBOARDING_10D3I_I0.md`
