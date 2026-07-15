# 04 — Modelo de dominio DNX Payments

## 1. Propósito

DNX Payments es el **bounded context financiero** reutilizable por ComprameLaFoto, Info Spot, FotoRank, Clickatón, FotoOffice y productos futuros.

Provider inicial: Mercado Pago (Orders API Split 1:N).  
El dominio **no** se acopla a Mercado Pago.

## 2. Límites del dominio

### Qué hace

- Aceptar un `PaymentIntent` con monto, moneda, recipients y metadatos opacos.
- Calcular un `DistributionPlan` / `DistributionEntry`.
- Orquestar un provider de pagos.
- Registrar webhooks de forma idempotente.
- Mantener un ledger append-only.
- Exponer saldos, settlements y refunds/chargebacks a nivel financiero.

### Qué NO hace

| Producto | Concepto de producto | En Payments |
|---|---|---|
| CLF | álbum, foto, print, lab | Solo `externalReference` opaco |
| FotoRank | concurso, inscripción, jurado | Idem |
| Clickatón | maratón, categoría | Idem |
| Info Spot | artículo, editor, atribución | Idem (roles de recipient, no CMS) |
| FotoOffice | curso, matrícula | Idem |

DNX Payments **no conoce** fotógrafos, organizadores, álbumes ni concursos como entidades de negocio. Solo conoce **recipients** tipados por rol financiero (`PHOTOGRAPHER`, `ORGANIZER`, …) sin semántica de producto.

## 3. Lenguaje ubicuo — entidades

### PaymentIntent

- **Responsabilidad:** intención de cobro creada por un producto DNX antes de hablar con el provider.
- **Owner:** producto emisor (`productId` + `externalReference`).
- **Estados:** `DRAFT` → `READY` → `SUBMITTED` → `SUCCEEDED` \| `FAILED` \| `CANCELED` \| `EXPIRED`.
- **Invariantes:** monto > 0; moneda válida; al menos un recipient efectivo tras distribución; `idempotencyKey` única por producto.
- **Ciclo:** draft → validación/distribución → submit provider → terminal por webhook o timeout.
- **Relaciones:** 1→N `PaymentAttempt`; 0..1 `PaymentOrder`; 1 `DistributionPlan`.

### PaymentOrder

- **Responsabilidad:** orden financiera interna DNX (fuente de verdad de negocio).
- **Owner:** DNX Payments.
- **Estados:** `CREATED` → `AWAITING_PROVIDER` → `AUTHORIZED` → `CAPTURED` / `PAID` → `PARTIALLY_REFUNDED` \| `REFUNDED` \| `CHARGED_BACK` \| `FAILED` \| `CANCELED`.
- **Invariantes:** suma de `DistributionEntry` = `totalAmount` (salvo políticas de fee externas marcadas `WAITING_MP_CONFIRMATION`); un solo plan activo.
- **Relaciones:** 1 `PaymentIntent`; 0..N `ProviderOrder`; 0..N `Refund` / `Chargeback`; N `LedgerEntry`.

### ProviderOrder

- **Responsabilidad:** proyección de la orden en el provider (`mpOrderId`, etc.).
- **Owner:** adapter del provider.
- **Estados:** `PENDING` → `OPEN` → `PROCESSED` → `REFUNDED` / `CHARGED_BACK` / `FAILED` / `CANCELED`.
- **Invariantes:** `provider` + `providerOrderId` únicos; no mutar payload crudo (solo append de snapshots).
- **Relaciones:** N `ProviderPayment`.

### ProviderPayment

- **Responsabilidad:** pago/transacción concreta en el provider (p.ej. `PAY…`).
- **Estados:** alineados a provider (`PENDING`, `APPROVED`/`PROCESSED`, `REJECTED`, `REFUNDED`, `CHARGED_BACK`).
- **Invariantes:** pertenece a un `ProviderOrder`.

### PaymentAttempt

- **Responsabilidad:** intento de submit (retry, recovery).
- **Estados:** `STARTED` → `SUCCEEDED` \| `FAILED`.
- **Invariantes:** cada intento tiene su propia `idempotencyKey` o deriva de la del intent + attempt number.

### Recipient

- **Responsabilidad:** beneficiario lógico DNX (no es cuenta MP).
- **Campos clave:** `recipientId`, `role`, `productUserRef` (opaco), opcional `displayLabel`.
- **Invariantes:** estable en el tiempo; un Recipient puede tener N `ProviderRecipient`.

### ProviderRecipient

- **Responsabilidad:** vínculo Recipient ↔ identidad en provider (`receiver_id`, `user_id`, email).
- **Estados vía SplitConsent:** ver Consent.
- **Invariantes:** un provider + un external id únicos por vínculo activo.

### SplitConsent

- **Responsabilidad:** consentimiento provider para recibir splits (MP Split Consent).
- **Estados:** `PENDING` \| `ACTIVE` \| `REJECTED` \| `CANCELED` \| `EXPIRED`.
- **Invariantes:** solo `ACTIVE` puede participar en distribución ejecutable; `receiverId` inmutable una vez emitido.
- **Relaciones:** 1 `ProviderRecipient` (secondary); referencia al primary provider account.

### DistributionPlan

- **Responsabilidad:** plan calculado (o plantilla) de cómo se reparte el dinero.
- **Estados:** `DRAFT` → `CALCULATED` → `LOCKED` → `EXECUTED` \| `SUPERSEDED`.
- **Invariantes:** tras `LOCKED`, inmutable; suma de entradas = total (modo fijo) o 100% (porcentaje), según reglas del engine.

### DistributionEntry

- **Responsabilidad:** línea del plan (recipient + monto/porcentaje + prioridad).
- **Invariantes:** amountMinor ≥ 0; no recipients duplicados en el mismo plan.

### LedgerAccount

- **Responsabilidad:** cuenta contable lógica (por recipient, plataforma, clearing, fees).
- **Tipos:** `ASSET`, `LIABILITY`, `REVENUE`, `EXPENSE`, `CLEARING`.
- **Invariantes:** código único; nunca se borra.

### LedgerEntry

- **Responsabilidad:** movimiento append-only (partida doble o multi-leg).
- **Invariantes:** no update/delete; `runId` opcional de reconciliación; suma de legs = 0 en el journal set.
- **Estados:** no hay mutación; solo `POSTED` al insertar.

### Settlement

- **Responsabilidad:** cierre de período / lote de saldos a liquidar (ops o payout).
- **Estados:** `OPEN` → `CALCULATED` → `APPROVED` → `PAID` \| `FAILED` \| `CANCELED`.
- **Invariantes:** no incluir entries posteriores al `cutoffAt`.

### Balance

- **Responsabilidad:** proyección de saldo (derivada del ledger, cacheable).
- **Estados:** `CURRENT` (siempre recalculable); flags `AVAILABLE` / `HELD` / `PENDING`.
- **Invariantes:** no es fuente de verdad; el ledger sí.

### Refund

- **Responsabilidad:** reembolso total/parcial, posiblemente por recipient.
- **Estados:** `REQUESTED` → `SUBMITTED` → `PROCESSED` \| `FAILED` \| `CANCELED`.
- **Invariantes:** no exceder capturado neto por entry; idempotency key única.

### Chargeback

- **Responsabilidad:** contracargo / disputa provider.
- **Estados:** `OPEN` → `IN_PROCESS` → `WON` \| `LOST` \| `CLOSED`.
- **Invariantes:** genera ledger de hold/reversal; no borra historial.

### WebhookInbox

- **Responsabilidad:** recepción cruda + deduplicación.
- **Estados:** `RECEIVED` → `PROCESSING` → `PROCESSED` \| `FAILED` \| `IGNORED`.
- **Invariantes:** clave idempotente `(provider, eventKey)`; payload inmutable.

### ReconciliationRun

- **Responsabilidad:** corrida de conciliación vs reportes provider.
- **Estados:** `STARTED` → `COMPLETED` \| `FAILED` con diffs.
- **Invariantes:** append-only de hallazgos.

### AuditEvent

- **Responsabilidad:** traza de quién/qué/cuándo (sin secretos).
- **Invariantes:** append-only; nunca loguear tokens ni PAN.

## 4. Flujos (resumen)

Patrón común:

```
PaymentIntent → Validaciones → DistributionPlan → Provider → WebhookInbox → Ledger → Settlement
```

| Caso | Intent tipificado | Recipients típicos |
|---|---|---|
| Compra fotografía (CLF) | `PHOTO_PURCHASE` | PLATFORM, PHOTOGRAPHER, ORGANIZER?, LAB?, REFERRAL? |
| Inscripción concurso (FotoRank) | `CONTEST_ENTRY` | PLATFORM, ORGANIZER |
| Inscripción maratón (Clickatón) | `MARATHON_ENTRY` | PLATFORM, ORGANIZER |
| Venta atribuida Info Spot | `ATTRIBUTED_SALE` | PLATFORM, INFOSPOT_EDITOR, PHOTOGRAPHER? |
| Marketplace futuro | `MARKETPLACE_SALE` | PLATFORM + N sellers |

Detalle de secuencia en §6 de este doc y en `06-distribution-engine.md`.

## 5. Estados y transiciones

Ver máquina de estados en `packages/payments/src/core/states.ts`.

Reglas generales:

- Estados terminales no revierten salvo eventos compensatorios (`Refund`, `Chargeback`) que **añaden** historia.
- Transiciones inválidas lanzan error de dominio (no silent no-op en core).

## 6. Flujo detallado — compra de fotografía

1. CLF crea `PaymentIntent` con `externalReference=albumOrder:123`, total, currency `ARS`.
2. Validaciones: monto, moneda, recipients con consent ACTIVE (cuando Split 1:N esté activo).
3. Distribution Engine calcula plan (porcentajes/fijos + redondeo).
4. Provider adapter crea `ProviderOrder` (futuro: Orders API).
5. Webhook → `WebhookInbox` → GET provider → `PaymentApproved`.
6. Ledger: debit clearing / credit liabilities por recipient.
7. Settlement periódico o payout ops según producto.

**Nota Etapa 02:** CLF productivo sigue en Preferences + `marketplace_fee`. Este flujo es el **modelo objetivo**, no el cutover.

## 7. Owner / fee MP / impuestos

Marcados explícitamente:

| Tema | Estado |
|---|---|
| Seller Primary definitivo | `WAITING_MP_CONFIRMATION` |
| Distribución fee Mercado Pago | `WAITING_MP_CONFIRMATION` |
| Impuestos / retenciones | `WAITING_MP_CONFIRMATION` |
| Liquidaciones / payouts automáticos | `WAITING_MP_CONFIRMATION` |

El dominio admite **políticas enchufables** (`FeeAllocationPolicy`, `PrimaryAccountPolicy`) sin hardcodear la respuesta de MP.

## 8. Casos futuros (cobertura del modelo)

| Caso | Soporte |
|---|---|
| Referidos / embajadores / afiliados | `RecipientRole` + entry opcional |
| Editores Info Spot | rol `INFOSPOT_EDITOR` |
| Sponsors | rol `SPONSOR` |
| Nuevos providers | `PaymentProvider` |
| Nuevas monedas | `CurrencyCode` + Money |
| Beneficiarios opcionales | entries con `optional: true` omitidas si monto 0 / sin consent |

## 9. Paquete

Implementación de contratos y reglas puras: `@repo/payments`.  
Sin Prisma, sin HTTP a MP, sin cambios a apps en esta etapa.
