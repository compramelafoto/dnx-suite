# Mercado Pago Split 1:N — Contrato canónico de Order (DNX Payments)

**Fecha:** 2026-07-31  
**Paquete:** `@repo/payments`  
**Scope:** Orders API Split 1:N (Argentina / MLA).  
**No cubre:** Card Payment Brick, refunds reales, Split 1:1 CLF.

---

## 1. Contrato canónico DNX Payments

Entrada principal: `CreateSplitOrderInput` → `MercadoPagoOrdersAdapter.createSplitOrder`.

| Campo | Obligatorio | Notas |
| --- | --- | --- |
| `externalReference` | sí | Opaco; anti-PII (`buildOpaqueExternalReference`) |
| `total` | sí | `Money` (bigint minor units) |
| `distribution` | sí | Calculada por Distribution Engine |
| `payerEmail` | sí | Email real del pagador |
| `deviceSessionId` | sí | Contexto frontend → header `x-meli-session-id` |
| `idempotencyKey` | sí | Header `X-Idempotency-Key` |
| `partnerReceiverIds` | sí | Map recipientId → MP receiver UUID |
| `partnerConsentsByRecipientId` | sí | Evidencia real ACTIVE (no hardcode) |
| `items[]` | sí | Intangibles (title, quantity, unitPrice) |
| `statementDescriptor` | sí* | \*o `defaultStatementDescriptor` del adapter |
| `paymentToken` / `paymentMethodId` | condicional | Requeridos para cobrar con tarjeta |
| `mpSplitAmountTypeStrategy` | no | Default `fixed_preferred` |

Validación central: `validateMercadoPagoSplitOrder()` — **antes** de cualquier POST a MP.

---

## 2. Mapping a Mercado Pago

| DNX | MP Orders |
| --- | --- |
| `type` fijo | `type: "online"` |
| `externalReference` | `external_reference` |
| `total` | `total_amount` (decimal string money-safe) |
| `payerEmail` | `payer.email` |
| `items[]` | `items[]` + `additional_info.items[]` |
| calculated splits (fixed) | `splits[]` + `config.split_rules.amount_type = "fixed"` |
| owner | `receiver_type: "owner"` |
| partner | `receiver_type: "partner"` + UUID |
| `statementDescriptor` | `transactions.payments[].payment_method.statement_descriptor` |
| `deviceSessionId` | header `x-meli-session-id` |
| `idempotencyKey` | header `X-Idempotency-Key` |

Constante canónica: `MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS = 10`.

---

## 3. Campos obligatorios (homologación)

- `type = online`
- `external_reference` opaco
- `payer.email`
- `additional_info.items[].unit_price` + `quantity` (+ title)
- splits owner + 0..10 partners
- consent ACTIVE real por partner
- `x-meli-session-id`
- suma fixed = `total_amount` cuando `amount_type = fixed`

---

## 4. Campos opcionales

- `items[].category_id`, `description`, `id`
- `paymentToken` / método (si se cobra en create)
- `integrator_id` / `platform_id`
- `mpSplitAmountTypeStrategy = "infer_from_rules"` (compat; no default)

---

## 5. Errores de dominio

| Código | Cuándo |
| --- | --- |
| `CONSENT_REQUIRED` | missing / PENDING |
| `CONSENT_NOT_ACTIVE` | REJECTED / CANCELED / mismatch / testFixture sin flag |
| `CONSENT_EXPIRED` | status EXPIRED o `expiresAt` pasado |
| `PAYER_EMAIL_REQUIRED` / `PAYER_EMAIL_INVALID` | email |
| `STATEMENT_DESCRIPTOR_*` | descriptor |
| `ORDER_ITEMS_*` | items |
| `EXTERNAL_REFERENCE_PII` / `EXTERNAL_REFERENCE_*` | referencia |
| `DEVICE_SESSION_*` | device/session |
| `OrderValidationError` | suma splits, max partners, owner |

Consent errors **no** se mezclan con errores de pago del PSP.

---

## 6. Reglas monetarias

1. Reglas comerciales pueden ser `%` o fixed en Distribution Engine.  
2. Default hacia MP: **`fixed_preferred`** — se calculan montos y se envía `amount_type = fixed`.  
3. Cálculos en bigint minor units (sin float JS).  
4. Validación: `sum(split amounts) == total_amount`.  
5. Percentage hacia MP sigue disponible vía `infer_from_rules`.  
6. Items: relación con total por defecto **`informative`** (descuentos/fees pueden hacer que `sum(items) ≠ total`). Usar `exact` solo si el consumidor lo garantiza.

---

## 7. Lifecycle del consentimiento

Estados: `PENDING` → `ACTIVE` → (`REJECTED` | `CANCELED` | `EXPIRED`).

Antes de incluir un partner en `splits[]`:

1. Existe evidencia persistida/remota.  
2. `provider = mercadopago`.  
3. `receiverId` coincide con el UUID a enviar.  
4. `status = ACTIVE`.  
5. No expirado (`expiresAt`).  
6. Fixtures de test requieren `allowTestFixtures` + `testFixture: true` — no entran al flujo real accidentalmente.

---

## 8. Device / session

- Contrato: `deviceSessionId` → `x-meli-session-id`.  
- Prohibidos placeholders productivos (`MISSING_DEVICE`, etc.) salvo `allowTestFixtures`.  
- **DEVICE CONTEXT FRONTEND BLOCKED UNTIL BRICK** — la captura real del device id queda para IMPLEMENTACIÓN 03 (Card Payment Brick).

---

## 9. Acción legal

NO REQUERIDA en esta etapa.  
Minimización: no loggear tokens ni PII innecesaria; `external_reference` opaco.
