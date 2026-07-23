# CLICKATÓN — ETAPA 10D3I-F — ACTIVACIÓN CONTROLADA DE MERCADO PAGO ORDERS 1:N TEST EN STAGING

**Fecha:** 2026-07-23
**Rama:** `migration-legacy-clf-to-monorepo`
**HEAD base:** `215a2d5` (10D3I-E)
**Veredicto:** **VALIDADO — ORDERS 1:N TEST STAGING OK**

## Objetivo

Crear y validar una orden **real** Mercado Pago Orders 1:N en **TEST/sandbox**, contra staging `ep-divine-smoke-av8hmt7s*` / `clickaton_staging`, con distribución **34/33/33**, sin tocar producción ni el checkout Preferences de Clickatón.

## Preflight

| Check | Resultado |
|---|---|
| Git rama | `migration-legacy-clf-to-monorepo` |
| HEAD base | `215a2d5` |
| Staging host | `ep-divine-smoke-av8hmt7s*` |
| Database | `clickaton_staging` |
| Migraciones | 64/64 |
| Acuerdo `partners-10d3i-e` | ACTIVE |
| DistributionVersion v1 | PUBLISHED |
| Total bps | 10000 |
| Snapshot 100000 ARS | intacto (`ods_d16a37…` / hash `ba5dedcc…`) |
| FI read | `LEGACY_ONLY` |
| Orders 1:N inicial | OFF |

### Credenciales TEST (presencia, sin valores)

| Recurso | Estado |
|---|---|
| Access Token TEST | presente (`APP_USR-…`, sandbox-eligible) |
| Public Key TEST | presente |
| Owner TEST | presente (numérico) |
| Receiver #1 | presente (prefix `748d158f…`) |
| Receiver #2 | presente (prefix `52a3dbe1…`) |
| Consent #1 | ACTIVE |
| Consent #2 | ACTIVE |
| Device ID | presente |
| Payment Token | presente (efímero; regenerado para create CLI) |

**Nota MCP:** `mp_split_preflight_status` puede reportar `paymentTokenPresent/deviceIdPresent=false` hasta reiniciar el proceso MCP. La CLI carga `services/dnx-mcp/.env.local` desde disco y vio READY completo.

## Flag

`DNX_MP_ORDERS_1N_STAGING_ENABLED` — default **off**.

Create real exige: flag on + sandbox + confirms CLI (`--confirm-staging` `--confirm-orders-test`) + token/device/receivers. La CLI fuerza **off** en `finally`.

## Mapping TEST overlay

| Participante | Rol MP | Bps | Overlay |
|---|---|---:|---|
| Dani | owner (user id TEST) | 3400 | owner numérico |
| Rodrigo | partner receiver #1 | 3300 | UUID TEST consent ACTIVE |
| Tamara | partner receiver #2 | 3300 | UUID TEST consent ACTIVE |

Snapshot 10D3I-E se **referencia**, no se muta. Overlay TEST no escribe `User.mp*` / `Lab.mp*`.

## Payload sanitizado

- `amount_type`: percentage
- recipients: 3
- amounts: `34.00` / `33.00` / `33.00`
- total: `1000.00` ARS (100000 minor)
- `payment_method.id`: `visa` + token PRESENT
- header `x-meli-session-id`: device PRESENT
- `payer.email`: `*@testuser.com`

## Orden TEST

| Campo | Valor sanitizado |
|---|---|
| Resultado | **CREADA** |
| provider order id | `ORDTST01…` |
| external_reference | `clickaton-10d3i-f-1784777000491` |
| status canónico | `PROCESSED_ACCREDITED` |
| status_detail | `accredited` |
| idempotency key | prefix `ab2060bd…` |

CLI:

```bash
DATABASE_URL=… DIRECT_URL=… \
pnpm --filter @repo/payments orders-1n:activate-staging -- \
  --create-order --confirm-staging --confirm-orders-test
```

Evidencia sanitizada: `.local/audit-10d3i-f/` (no versionar).

## Idempotencia

| Caso | Resultado |
|---|---|
| Misma key + mismo payload | misma orden (`sameOrder=true`) |
| Misma key + payload distinto | conflicto / bloqueo (`conflictBlocked=true`) |

## Rechazos controlados

Bloqueados: flag off, confirm ausente, environment production, payment token faltante, device id faltante, receivers incompletos, total bps 9999/10001.

## Webhook / parser

Opción **B**: parser Orders con fixture sanitizado (`order` / `ORD-FIXT…`, `live_mode=false`). Evento webhook real TEST pendiente → etapa G.

## Snapshot intacto

Antes/después create + idempotency:

- mismo id `ods_d16a37…`
- mismo hash `ba5dedcc…`
- mismos bps 3400/3300/3300
- mismos importes 34000/33000/33000
- external_reference histórico `clickaton-10d3i-e-sim-order-100000` sin reescritura

## Rollback

Estado final obligatorio:

| Flag / modo | Valor |
|---|---|
| Orders 1:N | **OFF** |
| FI read | `LEGACY_ONLY` |
| FI write | off |
| backfill | off |
| FINANCIAL_IDENTITY_ONLY | off |
| PREFER global | off |
| Checkout Pro Clickatón | intacto |

## Seguridad

- Sin secretos en Git / docs.
- Sin tokens / device / receiver IDs completos en reportes versionados.
- Sin cuentas MP reales Dani/Rodri/Tamara.
- Sin OAuth productivo.
- Sin porcentajes productivos definitivos.
- Host gate: solo `ep-divine-smoke-av8hmt7s*` + `clickaton_staging`.

## Limitaciones

- Webhook real TEST no capturado en esta etapa (parser fixture OK).
- Payment token es de un solo uso; hay que regenerarlo para cada create.
- MCP create-order tool sigue en split 1 partner (fixed); create 3-way usa CLI `@repo/payments`.
- Orders 1:N no queda activo en runtime Clickatón.

## Caso Rodrigo

- cuenta real consultada: **no**
- cuenta real conectada: **no**
- receiver TEST utilizado: **sí**
- migración real pendiente: **sí**

## Código

| Pieza | Path |
|---|---|
| Flag + gate | `packages/payments/src/providers/mercado-pago/orders/orders-1n-flag.ts` |
| Adapter paymentToken / method id | `orders/adapter.ts`, `orders/mapper.ts` |
| CLI controlada | `packages/payments/src/cli/activate-orders-1n-staging.ts` |
| Script | `pnpm --filter @repo/payments orders-1n:activate-staging` |

## Seguimiento 10D3I-G

Webhook firmado + reconciliación GET + snapshot intacto validados. Ver:

`docs/clickaton/ORDERS_1N_WEBHOOK_RECONCILIATION_10D3I_G.md`

## Seguimiento 10D3I-H

Checkout de inscripción Clickatón ↔ DNX Payments ↔ Orders 1:N (staging). Ver:

`docs/clickaton/REGISTRATION_CHECKOUT_DNX_PAYMENTS_STAGING_10D3I_H.md`

## Seguimiento 10D3I-I0

Gobernanza onboarding socios MP reales (sin OAuth):
`docs/clickaton/MERCADO_PAGO_PARTNERS_PRODUCTION_ONBOARDING_10D3I_I0.md`
