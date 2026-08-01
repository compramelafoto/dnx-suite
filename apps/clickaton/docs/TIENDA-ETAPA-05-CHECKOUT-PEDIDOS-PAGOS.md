# TIENDA — Etapa 05 — Checkout, pedidos y reserva de stock

**Estado:** implementado con feature flags OFF por defecto.  
**ACCIÓN LEGAL REQUERIDA ANTES DE PRODUCCIÓN.**

No deploy / no commit / no push desde esta etapa.

---

## Auditoría inicial

| Área | Hallazgo | Decisión |
|------|----------|----------|
| Órdenes | Solo `ClickatonRegistration` (inscripción). No había orden de tienda. | **Crear** `ClickatonStoreOrder` + items |
| Holds | `ClickatonStockHold` amarrado a `registrationId` | **Crear** `ClickatonStoreStockHold` (no reutilizar FK) |
| Ledger | `STORE_HOLD` / `STORE_SALE` / `STORE_RELEASED` + `storeHoldIdempotencyKey` | **Reutilizar** |
| DNX Payments | `createClickatonCheckoutService`, durable client, webhook `/api/webhooks/dnx-payments` | **Reutilizar** extendiendo `sourceType: STORE_ORDER` |
| Mercado Pago | Bridges test/live/orders vía DNX | **No duplicar** |
| Collector | OAuth owner + distribution ACTIVE por edición | **Provisional:** mismo collector de la edición del producto; sin split complejo / comisión 0 en plan |
| Cron | `expire-registration-holds` | **Nuevo** `expire-store-holds` (mantener ON aunque checkout OFF) |
| Rate limit | Inscripción in-memory | Mismo patrón in-memory; **documentar** durable para prod |
| Emails | Resend existente | **Pendiente** (no bloquea pago); eventos logueados |

---

## Modelos y migraciones

**Reutilizados:** `ClickatonProduct`, `ClickatonProductVariant` (`stock`/`reservedStock`), `ClickatonInventoryMovement`, DNX payment orders/intents.

**Creados:**
- `ClickatonStoreOrder`
- `ClickatonStoreOrderItem` (snapshots)
- `ClickatonStoreStockHold`
- Enums de estado orden / pago / hold / delivery

**Migración generada (NO aplicada en prod):**  
`packages/db/prisma/migrations/20260802010000_clickaton_store_orders/migration.sql`

Comando (solo base autorizada):

```bash
# Desde monorepo, con DATABASE_URL de staging/local autorizada
npx prisma migrate deploy
# o generate + migrate en el flujo del monorepo
```

---

## Feature flags

| Variable | Default | Efecto |
|----------|---------|--------|
| `CLICKATON_STORE_CHECKOUT_ENABLED` | `false` | OFF → carrito OK, checkout/API órdenes 403 |
| `CLICKATON_STORE_PAYMENTS_LIVE` | `false` | Bloquea provider production/live de tienda |
| `STORE_HOLD_TTL_MINUTES` | `15` | TTL hold (5–120) |

**Rollback mínimo:** `CLICKATON_STORE_CHECKOUT_ENABLED=false`  
Mantiene tienda + carrito + webhooks + cron de liberación.

**Entornos:**
- Local/sandbox: checkout ON + `CLICKATON_DNX_PAYMENTS_PROVIDER=manual|mercado_pago_test` + payments live OFF
- Staging MP: checkout ON + MP test + webhook staging
- Producción: **no habilitar** hasta acción legal + `STORE_PAYMENTS_LIVE` consciente

---

## Máquina de estados (orden)

`DRAFT → PENDING_PAYMENT → PAID | PAYMENT_FAILED | EXPIRED | CANCELLED`  
`PAID → READY_FOR_PICKUP | SHIPPED | REFUNDED`  
Prohibido: `PAID → DRAFT`.

Pago separado: `CREATED | PENDING | APPROVED | REJECTED | …`

**PAID solo por webhook/S2S verificado**, nunca por return URL.

---

## Flujo

```
carrito local → POST /api/store/cart/validate
  → /tienda/checkout (revalida)
  → POST /api/store/orders (idempotente)
  → holds + reservedStock++ + ledger STORE_HOLD
  → DNX Payments preference (STORE_ORDER / CLICKATON_STORE_ORDER:{publicId})
  → MP return /tienda/pago/{exito|pendiente|error} (solo consulta)
  → webhook dnx-payments → applyStorePaymentEvent
  → APPROVED: STORE_SALE + stock-- + reserved-- + PAID
  → CANCELLED/EXPIRED: STORE_RELEASED + reserved-- 
  → cron expire-store-holds
```

---

## Idempotencia

- Creación: `clientIdempotencyKey` unique + `commercialFingerprint`
- Preferencia: `paymentIdempotencyKey` / DNX idempotency
- Webhook: eventId DNX + ledger keys `store:{orderId}:var:{variantId}:{hold|sale|release}`
- Captura: no doble `STORE_SALE`

---

## Stock

| Momento | reservedStock | stock |
|---------|---------------|-------|
| Crear orden | ++ | igual |
| Expire / reject cancel | -- | igual |
| APPROVED captura | -- | -- |
| Webhook duplicado | no-op | no-op |

TTL: `STORE_HOLD_TTL_MINUTES` (default 15). Update condicional SQL anti-oversell.

---

## URLs

- `/tienda/checkout`
- `/tienda/pedido/[orderPublicId]` (cookie HttpOnly `ck_store_order_access` o `?t=`)
- `/tienda/pago/exito|pendiente|error`
- `POST /api/store/orders`
- `POST /api/store/orders/retry-payment`
- `POST /api/webhooks/dnx-payments` (router STORE_ORDER)
- `GET /api/cron/expire-store-holds`

---

## Acceso a pedido

`publicId` alta entropía (`sto_…`) + `accessToken` hasheado (SHA-256). Cookie HttpOnly path `/tienda`. No enumeración por ID secuencial.

---

## Entrega

- **Retiro:** habilitado (punto estático + instrucciones).
- **Envío:** deshabilitado (sin proveedor tarifario). No se inventan costos.

---

## Collector (provisional)

Misma distribución ACTIVE de la edición del primer producto del carrito. Sin comisiones complejas / split fotógrafo-organizador. Documentar si Tammy 100% aplica también a tienda en config real de staging.

---

## Seguridad y privacidad

- Flag OFF default
- Rate limit IP + email + máx. 3 pendientes/email
- Payload max ~32KB
- Sin tarjeta en Clickatón
- Email/teléfono enmascarados en vista pública
- Logs sin PII completa
- Return URLs no marcan PAID

---

## Acción legal

**SÍ REQUIERE ACCIÓN LEGAL ANTES DE PRODUCCIÓN.**

Pendientes: términos de compra, cambios/devoluciones, entrega/retiro, privacidad, datos personales, ID fiscal vendedor, plazos, personalizados, disponibilidad, datos de envío incorrectos, cancelación, pagos rechazados/duplicados.

Copy provisional marcado en UI.

---

## Admin

Listado `/admin/tienda/pedidos` **postergado** a etapa siguiente (prioridad: integridad pública).

## Emails

Registro de eventos; envío Resend **no bloqueante** / pendiente templates TIENDA.

---

## Reutilización DNX Suite

| Capa | Qué |
|------|-----|
| Store Core (candidato) | estados, fingerprint, holds rules, DTOs |
| Adapter Clickatón | Prisma store order, rutas, branding, pickup |
| Payments adapter | DNX + `STORE_ORDER` external ref |
| Extracción a paquete | **postergada** |

---

## Pruebas sandbox MP

Con credenciales TEST:

1. Checkout ON + provider `mercado_pago_test`
2. Pago aprobado → webhook → PAID + stock capturado
3. Rechazado → hold se mantiene (retry)
4. Cancelado/expirado → release
5. Webhook duplicado → no doble descuento
6. Return success con orden aún PENDING → UI no miente

Sin credenciales: tests unitarios de dominio + provider `manual`.

---

## Riesgos / bloqueos

1. Migración no aplicada hasta entorno autorizado  
2. Rate limit no durable  
3. Admin pedidos pendiente  
4. Emails TIENDA pendientes  
5. Envío deshabilitado  
6. Legal bloquea producción  
7. Sandbox MP depende de secretos del entorno  
