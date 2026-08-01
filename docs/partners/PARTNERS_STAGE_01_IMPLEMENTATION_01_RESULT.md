# DNX Partners — ETAPA 01 / IMPLEMENTACIÓN 01 — Resultado

**Fecha:** 2026-08-01  
**Estado:** `DONE` (dominio + schema + admin Clickatón mínimo; sin deploy, sin commit)

---

## Resumen

Se implementó el dominio transversal **DNX Partners** (`@repo/partners` + tablas `DnxPartner*` + admin Clickatón en `/admin/sponsors`).

Principio respetado: **`requiresPayment` default false**; sin creación automática de órdenes, links MP ni recurrencias.

---

## Modelo implementado

```
DnxPartner
├── DnxPartnerContact[]
├── DnxPartnerParticipation[]
│     └── DnxPartnerContribution[]
│     └── (payment fields embebidos: requiresPayment, paymentMode, amount, notes)
├── DnxPartnerBenefit[]
│     └── DnxPartnerBenefitAudience[]
DnxPartnerGrant
DnxPartnerAuditEvent
```

### Diagrama de relaciones

```
Partner 1──* Contact
Partner 1──* Participation 1──* Contribution
Partner 1──* Benefit *──1 Participation?
Benefit 1──* Audience
Partner 1──* AuditEvent
Grant (userId + capability)  // capa aparte de DnxFinanceGrant
```

---

## Decisiones tomadas en esta etapa

| ID | Decisión |
|----|----------|
| P-01 | UI: **Sponsors y beneficios**; dominio: DNX Partners |
| P-02 | Owner ops v1: admin Clickatón (`isOpsAdmin` bundle) |
| D-02 | Partner puede existir sin User dueño |
| D-05 | **No** migrar `OrganizerLandingSponsor` |
| D-06 | Soft archive vía `status=ARCHIVED` + `archivedAt` |
| F-01 | Beneficio puede existir sin Participation |
| F-02 | Código híbrido (`promoCode` string + soft-link `promotionId`) |
| F-03 | Sin ledger de redenciones en v1 |
| A-01 | Tabla nueva `DnxPartnerGrant` (schema listo; admin v1 usa bundle ops) |
| A-04 | Separación UX: sponsors ≠ Finanzas · mi cuenta MP |
| $01–$03 | Payment fields embebidos en Participation; modo `NONE` default; sin MP |

### Diferencias vs propuesta inicial (`partners-domain-proposal.md`)

| Propuesta | Implementado |
|-----------|--------------|
| `displayName` | `name` (Stage 01) |
| Status DRAFT/SUSPENDED | PROSPECT / ACTIVE / INACTIVE / ARCHIVED |
| `DnxPartnerPaymentTerms` tabla separada | Campos de pago **en** `DnxPartnerParticipation` |
| `DnxBenefit` | `DnxPartnerBenefit` (prefijo consistente) |
| Audience `PRODUCT_BUYERS` / `CUSTOM_FUTURE` | `PRODUCT_PURCHASERS` / `CUSTOM_GROUP` (+ EDITION_PARTICIPANTS) |
| Contactos | `DnxPartnerContact` (no había modelo reutilizable) |

---

## Permisos

Capabilities enum `DnxPartnerCapability` + asserts en `@repo/partners`.

Equivalencias docs:

- `PARTNER_VIEW` → partners.view
- `PARTNER_CREATE` → partners.create
- `PARTNER_UPDATE` → partners.update
- `PARTNER_ARCHIVE` → partners.archive
- `PARTNER_PARTICIPATIONS_MANAGE` → partners.participations.manage
- `PARTNER_CONTRIBUTIONS_MANAGE` → partners.contributions.manage
- `PARTNER_BENEFITS_VIEW` → partners.benefits.view
- `PARTNER_BENEFITS_MANAGE` → partners.benefits.manage
- `PARTNER_BENEFITS_PUBLISH` → partners.benefits.publish
- `PARTNER_PAYMENTS_VIEW` / `MANAGE` → partners.payments.*
- `PARTNER_CONTACT_SENSITIVE` → contactos sensibles

v1 Clickatón: `toPartnerActor` marca `isOpsAdmin: true` tras `requireClickatonAdmin()`.

---

## APIs / servicios

Package `@repo/partners`:

- `createPartnersService(repo)` — casos de uso
- `PartnersRepository` — contrato
- `createMemoryPartnersRepository*` — tests
- Validadores + `assertNoAutomaticPaymentSideEffects`

Clickatón:

- `lib/admin/partners/prisma-partners-adapter.ts`
- `lib/admin/partners/runtime.ts`
- `lib/admin/partners/mutations.ts` (server actions)

No hay REST público en esta etapa.

---

## Migraciones

- `packages/db/prisma/migrations/20260802120000_dnx_partners_domain/migration.sql`
- Aditiva; sin backfill; sin drops.
- **No aplicada en producción** (instrucción). Local: `pnpm --filter @repo/db db:migrate` cuando corresponda.

---

## Casos de uso soportados

1. Tecnoflash: partner + participación FO/Clickatón sin pago + aportes SERVICE/DISCOUNT + beneficio + audiencia ORGANIZATION_MEMBERS / EVENT_PARTICIPANTS  
2. Vicario: partner + beneficio FREE_SERVICE sin código  
3. Sony: participación sponsor con `requiresPayment` opcional + aportes MONEY/PRIZE/VOUCHER + beneficio con código  
4. Premio Clickatón: contribución PRIZE/VOUCHER sin pago  

## Pendiente (siguientes etapas)

- Evaluador real de elegibilidad + UI FotoOffice  
- Bridge público Clickatón / FotoRank prizes  
- Activación/publicación de beneficios a usuarios finales (gate legal L-*)  
- Grants persistidos por usuario (hoy bundle ops)  
- PaymentTerms avanzados / link FI  
- Migración opcional CLF landing sponsors  

---

## Acción legal (recordatorio)

Antes de publicar beneficios reales: autorización de marca/logo, vigencia, condiciones, límites, responsabilidades partner/DNX, datos personales, restricciones de códigos/vouchers, premios, fiscalidad de aportes monetarios, cancelación/modificación. **No se redactaron contratos en esta etapa.**

---

## Verificaciones

| Check | Resultado |
|-------|-----------|
| `@repo/partners` tests | 17/17 pass |
| `@repo/partners` typecheck | pass |
| Clickatón `tsc --noEmit` | pass |
| ESLint partners admin paths | pass |
| Migración aplicada prod | **no** |
| Commit / push / deploy | **no** |
