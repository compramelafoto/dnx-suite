# 14 — Reporte Dominio: referidos / comisiones organizador / funnel

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `npx prisma validate` + `npx prisma format --check`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format --check` | ✅ **Formateado** |

---

## Resumen cuantitativo

| Métrica | Post Dominio 10 | Post Dominio 14 | Δ |
|---------|----------------:|----------------:|--:|
| Modelos | 206 | **211** | **+5** |
| Enums | 147 | **152** | **+5** |
| Líneas (git diff) | — | — | **+211 / −14** |

---

## 1. Modelos agregados (5)

Bloque `// BEGIN LEGACY MERGE — dominio 14 referidos / comisiones / funnel (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `PlatformMetrics` | Contador histórico singleton (`photosUploadedTotal`) |
| `FunnelVisit` | Eventos anónimos del funnel de compra |
| `OrganizerCommission` | Comisión escuela/organizador por pedido |
| `EventOrganizerCommission` | Snapshot inmutable comisión organizador de evento |
| `OrganizerCommissionWithdrawalRequest` | Retiro agrupado de comisiones de evento |

---

## 2. Modelos fusionados (5 existentes)

| Modelo | Cambios |
|--------|---------|
| **`ReferralAttribution`** | +`referralProgram`, +`sourceType`, +`sourceEntityId`; índices `sourceType/sourceEntityId`, `referralProgram` |
| **`ReferralEarning`** | +`referralProgram`; `@@unique([saleRef, attributionId])`; índice `referralProgram` |
| **`ReferralCode`** | Sin cambios (ya en paridad) |
| **`ReferralPayoutRequest`** | Sin cambios (ya en paridad) |
| **`Order`** | +`organizerCommissions`, +`eventOrganizerCommission` |

**Modelos con relaciones añadidas (sin cambio de campos escalares):**

| Modelo | Relaciones |
|--------|------------|
| **`User`** | `organizerCommissions`, `eventOrgCommissionsAsOrganizer/Photographer`, withdrawal requests |
| **`Album`** | `organizerCommissions`, `eventOrganizerCommissions` |
| **`School`** | `organizerCommissions` |
| **`Event`** | `eventOrganizerCommissions` |

---

## 3. Enums agregados (5)

| Enum | Valores |
|------|---------|
| `ReferralProgram` | `PHOTOGRAPHER_REFERRAL`, `ORGANIZER_REFERRAL` |
| `OrganizerCommissionStatus` | `PENDING`, `REQUESTED`, `PAID`, `REJECTED`, `CANCELLED` |
| `EventOrganizerCommissionStatus` | `PENDING`, `AVAILABLE`, `WITHDRAWAL_REQUESTED`, `PAID`, `CANCELLED` |
| `EventOrganizerCommissionPayoutMode` | `HELD_BY_PLATFORM`, `MARKETPLACE_SPLIT` |
| `OrganizerCommissionWithdrawalStatus` | `REQUESTED`, `APPROVED`, `PAID`, `REJECTED`, `CANCELLED` |

**Enum reutilizado (sin duplicar):** `OrganizerCommissionAppliesTo` — ya en dominio 4/Album.

**Enums sin cambios:** `ReferralStatus` — idéntico a legacy.

---

## 4. Relaciones agregadas

| Relación | Detalle |
|----------|---------|
| `OrganizerCommission` → `School`, `Album`, `Order`, `User?` | Comisión escolar por pedido |
| `EventOrganizerCommission` → `Order`, `Event`, `Album`, `User` (×2), `WithdrawalRequest?` | Comisión evento |
| `OrganizerCommissionWithdrawalRequest` → `User` (organizer + reviewer), `EventOrganizerCommission[]` | Retiros |
| `Order.organizerCommissions` / `eventOrganizerCommission` | Completa pendientes core commerce |

---

## 5. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 6. Pendientes (fuera de scope)

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | Campos `Event.organizerCommission*` y `EventPhotoPricingMode` (merge Event completo) | 9 |
| P2 | `OrganizerEventDownload`, `OrganizerPublicProfile`, landings organizador | 9 |
| P3 | Migración forward `20260704150000_clf_gap_organizer_exif_gear` §1 | Fase SQL |
| P4 | `FunnelVisit` sin FK a `Album`/`Order`/`User` (paridad legacy — solo scalars) | Opcional |

---

## 7. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos tocados

---

## 8. Diff resumido (git)

```
packages/db/prisma/schema.prisma | +211 / -14
```
