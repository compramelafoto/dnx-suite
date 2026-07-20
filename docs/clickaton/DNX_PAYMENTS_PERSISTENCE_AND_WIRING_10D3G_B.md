# Clickatón — Etapa 10D3G-B — Persistencia durable y cableado DNX Payments

## Objetivo

Convertir la integración contractual in-memory de 10D3G en una integración **durable**, con órdenes/eventos en tablas `DnxPayment*`, cliente tipado del monorepo y continuidad entre procesos — apta para smoke 10D3H.

## Situación previa (10D3G)

- Dominio Clickatón + `DnxPaymentsClient` + fake provider **in-memory**
- Soft refs en `ClickatonRegistration`
- Gap: órdenes no sobrevivían restart / multi-instancia

## Tablas reutilizadas (sin migración)

| Capacidad | Tabla | Estado |
| --------- | ----- | ------ |
| Intent | `DnxPaymentIntent` | Reutilizado (`sourceProduct=clickaton`) |
| Orden | `DnxPaymentOrder` | Reutilizado |
| Provider order | `DnxProviderOrder` | Reutilizado (`rawResponseSanitized.checkoutUrl`) |
| Idempotencia | `DnxPaymentIdempotencyRecord` | Reutilizado |
| Inbox | `DnxPaymentWebhookInbox` | Reutilizado |
| Audit | `DnxPaymentAuditEvent` | Reutilizado |
| Recipients | `DnxPaymentRecipient` | Stub PLATFORM owner+partner |

**Checkout URL:** no hay columna dedicada → `DnxProviderOrder.rawResponseSanitized.checkoutUrl` + snapshot en `DnxPaymentOrder.distributionSnapshot`.

**Estado normalizado EXPIRED vs CANCELLED:** ambos mapean a `CANCELED` en orden interna; se persiste `normalizedStatus` en snapshot/rawResponse.

## Fuente de verdad

| Dato | Fuente |
| ---- | ------ |
| Orden, intentos, checkout URL, eventos, idempotencia | **DNX Payments** (`@repo/payments` persistence) |
| Soft refs + estado derivado inscripción/holds | **Clickatón** |

El store in-memory de 10D3G queda solo para `CLICKATON_DNX_PAYMENTS_MODE=memory` (tests legacy).

## Arquitectura

```text
Clickatón server action
→ createClickatonCheckoutService (@repo/payments)
→ DnxPaymentIntent / Order / ProviderOrder / Idempotency
→ soft refs ClickatonRegistration
→ redirect checkoutUrl (allowlist)

Webhook HTTP (adapter temporal en Clickatón)
→ verify HMAC
→ applyNormalizedEvent (inbox + estado DNX)
→ efectos inscripción/holds
```

**Decisión de cliente:** llamada interna tipada en el mismo proceso/monorepo (`@repo/payments`), no HTTP interno firmado. Comparten `@repo/db` Prisma.

## Webhook y ubicación

Ruta actual `apps/clickaton/app/api/webhooks/dnx-payments` documentada como **adapter temporal**:

- no parsea MP crudo;
- no contiene reglas de holds/inscripción (delegadas a `CheckoutService`);
- deuda: mover endpoint al host DNX Payments cuando exista.

## Idempotencia durable

- Unique `(provider, environment, idempotencyKey)`
- Payload hash conflict → `IDEMPOTENCY_CONFLICT`
- Reuso de orden pendiente por `sourceProduct+externalReference`
- Carreras de intent: catch + `findByExternalReference`

## Atomicidad

Misma DB Prisma → efectos Clickatón y updates DNX en secuencia en el mismo proceso. No hay 2PC distribuido; inbox marca `PROCESSED` solo tras aplicar estado DNX; efectos Clickatón siguen en el use case (compensables vía reconcile/`MANUAL_REVIEW`).

## Reconciliación

`reconcileRegistrationPayment` / `ClickatonCheckoutService.reconcile`:

- `CONSISTENT` | `REPAIRED` | `MANUAL_REVIEW`
- Detecta soft ref rota, amount/currency mismatch, approved vs pending, múltiples approved, confirmed sin orden

## Seguridad

- HMAC webhook, eventId dedup, allowlist checkout host
- Sin SDK MP en client; sin confirmación por redirect; GET 405
- Logs sanitizados

## Fake provider

Fake vive en el servicio durable (URL sintética + `provider=manual`). Estado del proveedor no es fuente de verdad; la orden DNX sí.

## Tests

- `@repo/payments`: `clickaton-checkout-durable.test.ts` + suite existente
- `selfcheck:dnx-payments-persistence` con PG local descartable (`clickaton_10d3gb_*`)

## Requisitos para 10D3H

1. Credenciales TEST MP autorizadas
2. Host webhook DNX Payments o confirmación del adapter temporal
3. Smoke controlado sin producción
4. Evaluar columna `checkoutUrl` si Json resulta frágil

## Decisiones diferidas

Split 1:N real, payouts, refunds, chargebacks operativos, facturación, QR, cobros reales, Neon writes.
