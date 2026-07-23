# Clickatón — Etapa 10D3I-H — Integración del checkout de inscripciones con DNX Payments (staging)

## Objetivo

Integrar el checkout de inscripción Clickatón con DNX Payments en **staging TEST**, usando el acuerdo económico `partners-10d3i-e` (34/33/33), Orders 1:N sandbox, webhook/reconciliación, y confirmación atómica de Registration → credencial / kit / check-in — **sin** cuentas reales ni producción.

## Diagnóstico inicial

| Área | Estado previo a H |
| ---- | ----------------- |
| Checkout Clickatón | Preferences TEST (`mercado_pago_test`) o manual — **no** Orders 1:N |
| External ref | `clickaton:registration:{registrationId}` |
| Confirmación | Webhook payment / S2S → `confirmPaid` (CONFIRMED + APPROVED) |
| Credential | Schema + dominio; `confirmPaid` Prisma **ahora** emite credential + QR una vez |
| Kit / check-in | Reglas de elegibilidad post-pago (`post-payment-eligibility`) |
| Acuerdo E | ACTIVE, v1 PUBLISHED, 3400/3300/3300 — snapshot histórico **intacto** |
| Orders F/G | Create/observe flags OFF; pipeline observe validado |

## Arquitectura

```text
Participante
  → Registration PENDING_PAYMENT
  → CreateClickatonCheckout (flag H ON)
  → PaymentIntent + PaymentOrder DNX
  → Operational Distribution Snapshot (append-only)
  → Mercado Pago Orders 1:N TEST (flag create ON)
  → Webhook observe + GET reconcile (flag observe ON)
  → fulfillRegistrationFromOrdersObserve (solo si flag H ON)
  → applyNormalizedEvent APPROVED
  → confirmPaid → Credential + QR
  → Kit ELIGIBLE / Check-in habilitado
```

**Regla crítica:** el retorno del navegador **nunca** marca PAID. Solo webhook/reconciliación acreditada.

## Estados canónicos

| Entidad | Estados usados |
| ------- | -------------- |
| Registration | `PENDING_PAYMENT` → `CONFIRMED` (PAID canónico = CONFIRMED + APPROVED) |
| PaymentStatus | `PENDING` → `PROCESSING` → `APPROVED` |
| PaymentOrder DNX | `CREATED`/`PENDING`/`PROCESSING` → `APPROVED` |
| Orders MP | `PROCESSED_ACCREDITED` → mapea a APPROVED |

## Relaciones auditables

```text
Registration
  ↔ PaymentOrder (paymentOrderId soft ref)
  ↔ PaymentIntent (externalReference clickaton:registration:{id})
  ↔ ProviderOrder (providerOrderId)
  ↔ Operational Snapshot (distributionSnapshot metadata)
  ↔ WebhookInbox (observe)
  → Credential / QrToken
```

## External reference

- Preferences / manual: `clickaton:registration:{registrationId}`
- Orders 1:N TEST: `clickaton-registration-{registrationId}`

Mercado Pago Orders rechaza `:` en `external_reference` (`property_value` / pattern). El path Orders usa guiones; el fulfillment acepta ambos prefijos.

## Idempotencia

| Capa | Comportamiento |
| ---- | -------------- |
| Inicio checkout | Misma registration + payload → reusa orden activa |
| Create order | Misma idempotency key + payload → reuse; payload distinto → conflicto |
| Webhook | Mismo eventId → duplicate inbox |
| Confirmación | `confirmPaid` idempotente; credential/QR solo una vez |

## Precio congelado

Monto desde Registration (`totalAmount`) / TicketType — **nunca** desde frontend. Congelado en PaymentIntent/PaymentOrder `amountMinor`.

## Economic Agreement y snapshot

- Scope: `clickaton` / `STAGING_TEST` / `partners-10d3i-e`
- Snapshot operacional **nuevo** por compra (`buildClickatonOperationalSnapshot`)
- Snapshot histórico E (`clickaton-10d3i-e-sim-order-100000`) **no se muta**

## Feature flags

| Flag | Default | Ventana TEST | Final |
| ---- | ------- | ------------ | ----- |
| `DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED` | OFF | ON | OFF |
| `DNX_MP_ORDERS_1N_STAGING_ENABLED` | OFF | ON | OFF |
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | OFF | ON | OFF |

Selección de path:

- `CLICKATON_DNX_PAYMENTS_PROVIDER=manual` → fake (default)
- `mercado_pago_test` → Checkout Pro Preferences (legacy intacto)
- `mercado_pago_orders_test` → Orders 1:N (requiere flags H + create)

## Flujo UI

- Resumen inscripción: botón “Pagar (TEST)” + aviso TEST si flag H ON
- Retorno success/pending/error: consulta estado; **no** confirma pago
- Mensaje: “Estamos confirmando tu pago”

## Webhook / reconciliación

1. Observe pipeline G (firma, live_mode=false, GET, snapshot associate)
2. Si flag H ON + `PROCESSED_ACCREDITED` + ext ref registration → `fulfillRegistrationFromOrdersObserve`
3. `applyNormalizedEvent` → efectos Clickatón (`confirmPaid`)

Si flag H OFF → observe-only (comportamiento G).

## Credencial / Kit / Check-in

- Credential + QR emitidos en `confirmPaid` Prisma (idempotente)
- Kit: `ELIGIBLE` tras CONFIRMED + APPROVED + holds CONSUMED
- Check-in: requiere CONFIRMED + APPROVED + credential ACTIVE

## CLI

```bash
pnpm --filter @repo/payments exec tsx src/cli/registration-checkout-dnx-staging.ts --preflight
pnpm --filter @repo/payments exec tsx src/cli/registration-checkout-dnx-staging.ts --local-integration
pnpm --filter @repo/payments exec tsx src/cli/registration-checkout-dnx-staging.ts --e2e-sandbox --confirm-staging --confirm-orders-test
pnpm --filter @repo/payments exec tsx src/cli/registration-checkout-dnx-staging.ts --rollback-flags-off
```

Evidencia: `.local/audit-10d3i-h/` (gitignored).

## Compatibilidad

- CLF Preferences / marketplace_fee / collector / User.mp* / Lab.mp*: intactos
- Checkout productivo Clickatón (Preferences/manual): intacto detrás de provider mode
- Flags default OFF

## Seguridad

- Monto, acuerdo y recipients solo backend
- live_mode=false obligatorio en sandbox
- Host/database gate staging
- Logs sanitizados (prefixes)
- Tokens fuera de Git

## Rollback

Al finalizar (siempre, incluso si E2E falla):

- Checkout DNX OFF
- Orders create OFF
- Orders observe OFF
- FI LEGACY_ONLY (sin cambio en H)

## Limitaciones

- Payment token MP TEST es efímero (single-use); regenerar antes de cada create sandbox
- Monto sandbox Visa TEST: usar total válido (p. ej. 1000.00 ARS); montos muy bajos → `invalid_transaction_amount`
- HTTP webhook real desde panel MP sigue pendiente (H2 cerró con signed replay del order real)
- No cutover productivo

## 10D3I-H2 — E2E SANDBOX REAL

Fecha: 2026-07-23

| Ítem | Resultado |
| ---- | --------- |
| Payment token | regenerado (Visa TEST + MercadoPago.js); no expuesto; solo `.env.local` gitignored |
| Device ID | regenerado en la misma sesión browser (`security.js` view=checkout) |
| Preflight staging | `clickaton_staging` / `ep-divine-smoke-av8hmt7s*` / 64 migraciones / acuerdo ACTIVE |
| Fixture | Registration TEST PENDING_PAYMENT · total 100000 minor (1000.00 ARS) |
| Order sandbox | **CREADA** · prefix `ORDTST01KY…` · `PROCESSED_ACCREDITED` / accredited |
| External ref Orders | `clickaton-registration-{id}` |
| Observe | `SIGNED_REPLAY_REAL_ORDER` + GET live |
| Fulfillment | PaymentOrder APPROVED · Registration CONFIRMED · paidAt presente |
| Credential / QR | 1 / 1 · replay sin duplicar |
| Snapshot E | intacto (`ods_d16a37…` / `ba5dedcc6bcd…`) |
| Flags finales | checkout OFF · create OFF · observe OFF |

Evidencia: `.local/audit-10d3i-h2/` (gitignored).

Veredicto H2: **VALIDADO — CHECKOUT CLICKATÓN + DNX PAYMENTS SANDBOX E2E OK**

## Próxima etapa

**10D3I-I1** — conexión controlada owner MP (OAuth real solo con autorización manual):

`docs/clickaton/MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md`
