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

Estable: `clickaton:registration:{registrationId}`

- Única por `(sourceProduct, externalReference)`
- Sin secretos ni emails
- Persistida antes del create a MP
- Reutilizable en reconciliación

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

- Payment token MP TEST es efímero; create real puede quedar `BLOCKED_BY_PAYMENT_TOKEN`
- HTTP webhook real desde panel MP sigue pendiente (signed replay validado en G + H local)
- No cutover productivo

## Próxima etapa (no iniciar)

**10D3I-I** — Conexión controlada de cuentas Mercado Pago reales de los socios.
