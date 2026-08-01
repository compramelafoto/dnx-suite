# DNX Partners — ETAPA 02 / IMPLEMENTACIÓN 01 — Resultado

**Fecha:** 2026-08-01  
**Estado:** `DONE` (integración administrativa Clickatón por edición; sin deploy, sin commit)

---

## Resumen

Integración del dominio canónico `@repo/partners` / `DnxPartner*` dentro de la administración de cada edición de Clickatón (**Sponsors y beneficios**).

Principio respetado: participaciones **con o sin dinero**; `requiresPayment=true` solo guarda campos descriptivos (sin MP, órdenes, links, cron ni facturación).

---

## Fuente de verdad

| Dominio | Fuente de verdad |
|---------|------------------|
| Ficha comercial (nombre, logo, contactos) | `DnxPartner` |
| Vínculo a edición | `DnxPartnerParticipation` (`application=CLICKATON`, `contextType=EDITION`, `contextId=editionId`) |
| Aportes del partner | `DnxPartnerContribution` |
| Premio / categoría / ganador / entrega al ganador | **Clickatón** (`ClickatonPrizeBundle`, assignments) |
| Quién aporta el premio | Soft-link `contribution.prizeBundleId` |
| Beneficios y audiencias tipadas | `DnxPartnerBenefit` + `DnxPartnerBenefitAudience` |
| Acceso manual a beneficio | `DnxPartnerBenefitAccess` (**nuevo**) |
| Capabilities RBAC del módulo | `DnxPartnerGrant` (sin renombrar; **no** es acceso a beneficio) |

No se creó `ClickatonSponsor` ni duplicación de fichas en la edición.

---

## Rutas administrativas

| Ruta | Rol |
|------|-----|
| `/admin/ediciones/[editionId]/sponsors` | Resumen + tabla de participaciones |
| `/admin/ediciones/[editionId]/sponsors/vincular` | Buscar/crear partner + crear participación |
| `/admin/ediciones/[editionId]/sponsors/[participationId]` | Detalle: participación, aportes, premios, beneficios, grants, auditoría |
| `/admin/sponsors*` | Catálogo global (Etapa 01; sin cambios de modelo) |

Módulo añadido en `EditionDetailActions`: **Sponsors y beneficios**.

---

## Servicios Clickatón (`lib/admin/edition-partners`)

- `listEditionPartners`
- `getEditionSponsorsSummary`
- `createEditionPartnerParticipation`
- `updateEditionPartnerParticipation`
- `archiveEditionPartnerParticipation`
- `createEditionPartnerContribution`
- `linkContributionToPrize` (+ validación premio de la misma edición)
- `createEditionPartnerBenefit` + audiencia Clickatón
- `activateEditionBenefit` / `pauseEditionBenefit` / `archiveEditionBenefit`
- `grantEditionBenefitManually` / `revokeEditionBenefitGrant`
- Server actions en `mutations.ts`

Package `@repo/partners` extendido: listado por contexto, link a premio, grant/revoke access, labels ES, bloqueo de activación vencida, anti-duplicado de participación activa.

---

## Participante vs comprador (elegibilidad)

Modelo real Clickatón (`ClickatonRegistration`):

| Concepto | Campo / señal |
|----------|----------------|
| Persona inscripta (snapshot) | `firstName`, `lastName`, `email`, … |
| Usuario DNX vinculado | `userId` **nullable** (guest hasta confirmación/pago) |
| Confirmada | `status` + `confirmedAt` |
| Pago | `paymentStatus`, `paymentOrderId` (soft) |
| Comprador ≠ participante | Hoy **no** hay `buyerUserId` separado; el pagador puede ser la misma persona o un flujo guest. No asumir igualdad. |

**Decisión Stage 02:** las audiencias se **registran** (`EDITION_PARTICIPANTS`, `PRODUCT_PURCHASERS`, `CUSTOM_GROUP` con labels `CONFIRMED_REGISTRATION` / `WINNERS` / etc.) pero **no se evalúan** aún. No hay grants masivos automáticos.

Elegibilidad futura debe resolver identidad DNX confiable (userId vs email snapshot vs buyer) antes de materializar accesos.

---

## Grants: decisión

| Modelo | Significado |
|--------|-------------|
| `DnxPartnerGrant` | RBAC: capability del módulo partners (`PARTNER_*`) |
| `DnxPartnerBenefitAccess` | Acceso individual a un beneficio (manual / cortesía / excepción); estados `ACTIVE` / `REVOKED`; unique `(benefitId, userId)` |

Capability nueva: `PARTNER_BENEFITS_GRANT`.

---

## Flujos sin pago / con pago descriptivo

- `requiresPayment=false` (default): sin montos, sin side effects.
- `requiresPayment=true`: exige `PARTNER_PAYMENTS_MANAGE`; guarda modo/monto/notas; `assertNoAutomaticPaymentSideEffects` ⇒ sin orden, link ni recurrencia.

---

## Assets de marca

Etapa 01 Imp. 02 (assets multiplataforma) **no** implementada. Se usa `partner.logoUrl` temporalmente; puntos de integración documentados en UI de detalle.

---

## Migraciones

- `packages/db/prisma/migrations/20260802150000_dnx_partner_benefit_access/`
  - `DnxPartnerBenefitAccess` + enum status
  - `PARTNER_BENEFITS_GRANT` en `DnxPartnerCapability`
  - índice `DnxPartnerContribution.prizeBundleId`

**No aplicada en producción.** Local: `pnpm --filter @repo/db db:migrate` cuando corresponda.

---

## Permisos (v1 Clickatón)

Tras `requireClickatonAdmin()`, `toPartnerActor` → `isOpsAdmin: true` (bundle completo). Separación de capabilities lista en dominio para endurecer luego (ops vs finance).

No se reutiliza `DNX_FINANCE_PARTNER_CONNECT`.

---

## Tests

Package `@repo/partners`: suite ampliada (contexto edición, duplicados, premio, archive, beneficio vencido, benefit access, audiencias, permisos de pago).

---

## Deuda técnica / próximos pasos

1. Motor de elegibilidad (comprador vs participante vs guest).
2. Redención / QR / credencial digital.
3. Publicación pública de sponsors (con checklist legal).
4. Assets de marca multiplataforma.
5. Grants masivos solo con identidad DNX confiable.
6. Endurecer RBAC granular en Clickatón (quitar ops bundle ciego).
7. Historial de auditoría filtrado por edición en UI.

**Próxima implementación recomendada:** Etapa 02 Imp. 02 — elegibilidad + materialización controlada de accesos **o** Etapa 01 Imp. 02 — assets de marca.

---

## Acción legal (fuera de scope técnico)

Antes de publicar sponsors/beneficios reales: autorización de marca, vigencia, cupos, responsabilidad de premios/descuentos, fiscalidad de aportes monetarios, privacidad. No redactar contratos en esta etapa.
