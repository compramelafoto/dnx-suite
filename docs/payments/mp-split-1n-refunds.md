# Mercado Pago Split 1:N — Refunds (IMPLEMENTACIÓN 04)

**Fecha:** 2026-07-31  
**API:** `POST /v1/orders/{order_id}/refund`  
**Paquete:** `@repo/payments` / `@repo/payments/orders-1n-refunds`

---

## 1. Arquitectura

```
Admin/Service (autorizado)
→ createOrders1nRefundService.createRefund(RefundRequest)
→ remaining refundable (server)
→ proportional refund allocations (DNX)
→ MercadoPagoOrdersAdapter.refund()
→ POST /v1/orders/{id}/refund (+ X-Idempotency-Key)
→ persist PersistedRefundRecord (+ Prisma DnxPaymentRefund)
→ AppendOnlyLedger REFUND + REFUND_ALLOCATION
→ webhook observe (idempotent acknowledge)
→ reconcileMercadoPagoOrderRefunds() via GET Order
```

**No** usa endpoints de Checkout Pro / Split 1:1 CLF.

---

## 2. Contrato

### RefundRequest
- `paymentOrderId`, `providerOrderId`
- `orderTotalMinor`, `currency`
- `originalAllocations[]` (owner + partners)
- `amountMinor?` — omitido = total remaining
- `providerTransactionId?` — obligatorio si parcial
- `idempotencyKey`, `actor`, `reason?`

### RefundResult
- `refundId`, `providerRefundId(s)`, `amountMinor`, `status`, `allocations[]`, `orderStatusAfter`

Montos siempre en minor units (`bigint`). Sin floats.

---

## 3. Estados

| RefundStatus | Significado |
| --- | --- |
| REQUESTED | Creado localmente |
| SUBMITTED | Enviado a MP |
| PROCESSED | Confirmado |
| FAILED | Provider error |
| CANCELED | Cancelado local |

Payment order conserva historia: `PAID` → `PARTIALLY_REFUNDED` → `REFUNDED`.

---

## 4. Total refund

Body vacío. `amountMinor` omitido y remaining = order total.

## 5. Partial refund

Body: `transactions: [{ id: PAY…, amount: "x.xx" }]`.

Validaciones: `amount > 0`, `amount <= remaining`, múltiples parciales hasta agotar.

---

## 6. Idempotencia

Misma `idempotencyKey` + mismo payloadHash → mismo resultado (`reused: true`).  
Misma key + amount distinto → `IDEMPOTENCY_PAYLOAD_CONFLICT`.  
Header MP: `X-Idempotency-Key`.

---

## 7. Ledger

Append-only:

- `causeType: RefundProcessed` / purpose `refund`
- `causeType: RefundAllocation` / purpose `refund_allocation:{recipientId}`

Duplicados rechazados por `(causeType, causeId, purpose)`.

---

## 8. Allocation reversal

**Estrategia:** `PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER`

MP no devuelve breakdown por receiver en el refund response.  
DNX calcula shares proporcionales al split original con corrección determinística:

`sum(refund allocations) == refund total`

**LEGAL / BUSINESS RULE REVIEW REQUIRED** para fees de proveedor no reversibles / quién absorbe diferencias.

---

## 9. Webhook

`applyOrdersRefundWebhookEffects`:

- reconoce `REFUNDED` / `partially_refunded`
- **no** crea refund ni ledger desde webhook (evita doble posting)
- idempotente / duplicate-safe
- `attention` si provider refunded sin registro local

---

## 10. Reconciliation

`reconcileMercadoPagoOrderRefunds()` → GET Order + store local.

---

## 11. Security

`assertRefundAuthorized`:

- `trustedService: true` (admin/CLI/service) o
- `authorizedPaymentOrderIds` debe incluir el order

No endpoint público sin controles. Clickatón: **sin UI** en Imp 04 — llamar service desde admin futuro.

---

## 12. Sandbox testing

### UNIT / MOCK
```bash
pnpm --filter @repo/payments test
```

### SANDBOX REAL
```bash
DNX_CONFIRM_STAGING=true \
DNX_CONFIRM_ORDERS_TEST=true \
DNX_CONFIRM_REFUND_SMOKE=true \
MERCADOPAGO_TEST_ACCESS_TOKEN=… \
MERCADOPAGO_SMOKE_ORDER_ID=… \
MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID=… \
pnpm --filter @repo/payments smoke:orders-1n-refunds
```

Sin confirms → solo preflight (no writes).

---

## 13. Production checklist

- [ ] Flags production OFF
- [ ] Migration aplicada en staging (no prod desde Imp 04)
- [ ] Smoke sandbox real documentado
- [ ] Regla de negocio fees irreversible definida
- [ ] UI admin Clickatón (fuera de Imp 04)
- [ ] Homologación MP formal

---

## Clickatón (consumidor futuro)

```ts
import {
  createOrders1nRefundService,
  InMemoryRefundStore, // o Prisma store
} from "@repo/payments/orders-1n-refunds";
// actor.trustedService o authorizedPaymentOrderIds
// Nunca confiar amount del browser
```

`refundsBlocked` en edition finance permanece hasta wiring admin explícito.
