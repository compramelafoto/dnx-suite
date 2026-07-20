# Clickatón — Etapa 10D3G — Integración del checkout con DNX Payments

## Objetivo

Integrar el flujo público de inscripción/reserva (10D3F / 10D3F-B) con **DNX Payments** para que una reserva elegible pueda crear/reutilizar una orden de pago, redirigir al checkout, recibir eventos normalizados y confirmar o liberar holds — sin lógica de Mercado Pago en UI ni dominio de inscripción.

## Auditoría DNX Payments

| Capacidad | Existe | Ubicación | Calidad | Acción 10D3G |
| --------- | -----: | --------- | ------- | ------------ |
| Crear orden DNX Payments | Parcial | `packages/payments` + `CreateSplitPaymentOrderHandler` | Reutilizable con adaptador (split-oriented) | Cliente tipado Clickatón + fake provider |
| Obtener checkout URL | Parcial | Adapter MP Orders | Sandbox-only | Fake URL en cliente in-memory |
| Consultar estado | Sí | `getOrder` / refresh handlers | Reutilizable | `DnxPaymentsClient.getOrder/refreshOrder` |
| Idempotencia | Sí | `DnxPaymentIdempotencyRecord` + store | Reutilizable | Key estable inscripción+intento + payload hash |
| Referencia externa | Sí | Intent `externalReference` | Reutilizable | `clickaton:registration:{id}` |
| Webhook HTTP productivo | No | Inbox Prisma sin route | Incomplete | Route Clickatón `/api/webhooks/dnx-payments` (eventos ya normalizados) |
| Firma webhook | Parcial | Parser MP + secret | Incomplete en prod | HMAC `x-dnx-payments-signature` |
| Adaptador Mercado Pago | Sí | `packages/payments/.../mercado-pago` | Reutilizable sandbox | **No** importado por Clickatón |
| Persistencia orden | Sí | `DnxPayment*` Prisma | Reutilizable | Soft refs en `ClickatonRegistration` (sin migración) |
| Asociación inscripción | Soft refs | `paymentOrderId`, etc. | Reutilizable | Escritura en checkout/webhook |
| Pago aprobado/rechazado/pendiente | Mapping | Domain payments + Clickatón | Implementado | `mapProviderStatusToDnx` → efecto |
| Expiración | Sí | 10D3F-B + terminal release | Reutilizable | `releaseForPaymentTerminal` |
| Refund / Split final | No / diferido | Placeholder / Orders split | Out of scope | No implementado |

**Clasificación de integración existente:** *reutilizable con adaptador* (core `@repo/payments` maduro; falta wiring HTTP productivo y contrato checkout simple sin split).

## Modelo real utilizado

```text
Página pública / resumen
→ server action Clickatón
→ getRegistrationCheckoutEligibility
→ DnxPaymentsClient.createOrder
→ soft refs en ClickatonRegistration
→ redirect checkoutUrl

Proveedor (fake en tests)
→ evento normalizado firmado
→ POST /api/webhooks/dnx-payments
→ applyNormalizedEvent
→ confirmPaid | markPaymentStatus | releaseForPaymentTerminal
```

## Límites

| Capa | Responsable |
| ---- | ----------- |
| Clickatón | edición, sede, entrada, participante, inscripción, snapshot, cupo, holds, estados derivados |
| DNX Payments | orden, monto, moneda, proveedor, checkout URL, refs, estado normalizado, idempotencia comercial |
| Proveedor | UX de pago, aprobación/rechazo, notificación |

Clickatón **no** importa SDK Mercado Pago ni adaptador concreto del proveedor.

## Contrato de creación

`CreatePaymentOrderInput` en `apps/clickaton/lib/checkout/domain/types.ts`:

- `sourceApp: "CLICKATON"`, `sourceType: "REGISTRATION"`, `sourceId`
- `idempotencyKey`, `amountMinor` (entero), `currency: "ARS"`
- URLs success/pending/failure
- `payer` mínimo (email/nombre) — sin documento/teléfono en metadata de proveedor

## Elegibilidad

Obligatoria vía `getRegistrationCheckoutEligibility` (10D3F-B). Si no elegible → no se crea orden.

## Idempotencia

```text
clickaton:reg:{registrationId}:pay:{reservationIdempotencyKey}:a{attempt}
```

- Misma key + mismo payload → reutilizar
- Misma key + payload distinto → `IDEMPOTENCY_CONFLICT`
- Orden pendiente de la misma inscripción → reutilizar
- Doble submit paralelo → una sola orden (lock por key)

## Persistencia

Sin cambios de Prisma. Soft refs existentes:

- `paymentOrderId`, `paymentProvider`, `paymentExternalReference`, `paymentIdempotencyKey`, `paymentStatus`

Gap documentado: el store de órdenes del cliente fake es **in-memory por proceso** hasta wiring productivo a `DnxPaymentOrder` / HTTP DNX Payments (10D3H).

## Estados normalizados y mapping

| Estado proveedor (ej.) | Estado DNX | Efecto Clickatón |
| ---------------------- | ---------- | ---------------- |
| created / open | CREATED | PENDING_PAYMENT + PENDING, holds keep |
| pending | PENDING | idem |
| processing / in_process | PROCESSING | PENDING_PAYMENT + PROCESSING |
| approved / paid / processed | APPROVED | CONFIRMED + APPROVED, holds CONSUMED |
| rejected / failed | REJECTED | PENDING_PAYMENT + FAILED, holds keep, retry |
| cancelled | CANCELLED | CANCELLED + CANCELLED, liberar holds |
| expired | EXPIRED | CANCELLED + EXPIRED, liberar holds |
| refunded | REFUNDED | REFUNDED + REFUNDED (sin compensación monetaria) |
| charged_back | CHARGEBACK | payment MANUAL_REVIEW, alertar |

## Política hold vs pago pendiente

Si el proveedor sigue `PENDING` después de `holdExpiresAt`, el hardening 10D3F-B puede expirar la reserva. Una aprobación posterior con holds ausentes/vencidos **no confirma**: marca `MANUAL_REVIEW` y conflicto `HOLD_CONFLICT`.

## Webhook y seguridad

- Vive en Clickatón como receptor de eventos **ya normalizados** por DNX Payments (`/api/webhooks/dnx-payments`).
- Firma HMAC-SHA256 (`DNX_PAYMENTS_WEBHOOK_SECRET`), comparación constante.
- Idempotencia por `eventId`.
- Validación monto/moneda/asociación orden↔inscripción.
- No aprobar por query params del redirect.
- GET → 405.

## URLs de retorno

```text
/maratones/[slug]/inscripcion/pago/exito
/maratones/[slug]/inscripcion/pago/pendiente
/maratones/[slug]/inscripcion/pago/error
```

`displayAsApproved` solo si backend ya confirmó. Token HMAC en query.

## UI / CTA

`CheckoutPayButton` (client) → `startRegistrationCheckoutAction` (server). Solo si `checkoutEligible`.

## Server actions

| Action | Uso |
| ------ | --- |
| `createRegistrationCheckoutAction` | crear/reutilizar orden (JSON) |
| `startRegistrationCheckoutAction` | crear + redirect |
| `getRegistrationPaymentStatusAction` | consultar |
| `refreshRegistrationPaymentStatusAction` | refresh verificado |
| `getRegistrationCheckoutResultAction` | páginas de retorno |

## Cliente DNX Payments

```ts
interface DnxPaymentsClient {
  createOrder(input): Promise<CreatePaymentOrderResult>;
  getOrder(orderId): Promise<PaymentOrder | null>;
  refreshOrder(orderId): Promise<PaymentOrder | null>;
  verifyWebhook(headers, rawBody);
  applyVerifiedEvent(event);
}
```

Implementación 10D3G: `createInMemoryDnxPaymentsClient` (fake provider).

## Configuración (placeholders)

### Clickatón

- `CLICKATON_PUBLIC_URL`
- `CLICKATON_REGISTRATION_TOKEN_SECRET` (existente)
- `DNX_PAYMENTS_WEBHOOK_SECRET`
- `CLICKATON_FAKE_CHECKOUT_BASE_URL` (tests/dev)

### DNX Payments (no duplicar en Clickatón para prod)

- Credenciales proveedor TEST/PROD
- Collector / entorno
- Secretos MP (solo en módulo payments)

## Fake provider

Simula created/pending/approved/rejected/cancelled/expired, timeout, error temporal, amount/currency mismatch, orden desconocida, eventos duplicados.

## Admin

Detalle de inscripción: orden enmascarada, proveedor, ref enmascarada, estado, confirmedAt, idempotency truncada, warning `MANUAL_REVIEW`.

## Observabilidad

Eventos sanitizados (`checkout_requested`, `order_created`, `order_reused`, `redirect_issued`, `webhook_received`, `status_normalized`, `registration_confirmed`, `holds_released`, `conflict`, `invalid_amount`, `invalid_currency`). Sin PII ni secrets.

## Inconsistencias

Detectadas y no sobrescritas en silencio: amount/currency mismatch, asociación incorrecta, aprobación con holds vencidos → `MANUAL_REVIEW`.

## Tests

- Selfcheck: `pnpm --filter clickaton selfcheck:dnx-payments-checkout`
- Sin Neon, sin cobros reales, sin split final

## Riesgos pendientes

1. Persistencia de orden DNX no cableada a Prisma `DnxPayment*` desde Clickatón (store in-memory).
2. Webhook productivo de MP Orders aún no existe en `@repo/payments` HTTP; Clickatón consume eventos normalizados.
3. Credenciales TEST reales diferidas a 10D3H.
4. Reintento (attempt≥2) con key nueva tras FAILED — cobertura básica.

## Decisiones diferidas

- Split 1:N final, payouts, refunds automáticos, chargebacks operativos, facturación, QR/acreditación, email real, smoke MP TEST (10D3H).

## Selfcheck

```sh
pnpm --filter clickaton selfcheck:dnx-payments-checkout
```
