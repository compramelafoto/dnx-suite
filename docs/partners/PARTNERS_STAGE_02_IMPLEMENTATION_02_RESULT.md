# DNX Partners — ETAPA 02 / IMPLEMENTACIÓN 02 — Resultado

**Fecha:** 2026-08-02  
**Estado:** `DONE` (motor de elegibilidad + materialización controlada; sin deploy, sin commit, sin cron improvisado)

---

## Resumen

Se implementó el motor mínimo y seguro de **elegibilidad** y **materialización** de accesos a beneficios DNX Partners para Clickatón:

- Audiencia ≠ elegibilidad calculada ≠ acceso materializado ≠ redención.
- Materialización en `DnxPartnerBenefitAccess` con origen `MANUAL` / `AUTOMATIC`.
- Preview (dry-run) y Apply por beneficio; sync por edición con tolerancia a errores parciales.
- Identidad estricta: `userId` canónico o email exacto normalizado unívoco; sin nombre/IG/teléfono.
- Accesos manuales no se revocan por sync automática.
- Sin QR, redención, emails, MP, frontend público ni FotoOffice.

---

## Fuentes de verdad usadas

| Concepto | Fuente |
|----------|--------|
| Usuario DNX | `User.id` |
| Inscripción / participante | `ClickatonRegistration` (snapshot + `userId` nullable) |
| Confirmada | `ClickatonRegistration.status === CONFIRMED` |
| Cancelada / anulada | status `CANCELLED` / `REFUNDED` / `EXPIRED` / `DISQUALIFIED` |
| Comprador (v1) | **Proxy** documentado: `paymentStatus === APPROVED` o (`NOT_REQUIRED` + `CONFIRMED`). **No hay `buyerUserId`**. El sujeto materializado es la identidad de la inscripción, no el payer MP. |
| Categoría competitiva | `ClickatonPrompt.categoryId` + `ClickatonPhotoSubmission` (no `ticketTypeId`) |
| Ganador | `ClickatonPrizeAssignment.winnerRegistrationId` |
| Finalista | Diferido: sin FK confiable `FotorankResultEntry` → registration |
| Staff / org members / ALL_USERS | Sin sync automática en esta etapa |
| Acceso materializado | `DnxPartnerBenefitAccess` |
| Corrida / lock soft | `DnxPartnerBenefitSyncRun` |

No se crearon tablas espejo de inscripciones, compras o resultados.

---

## Diferencia comprador / participante

- **Participante:** persona de la inscripción (snapshot + vínculo opcional a `userId`).
- **Comprador v1:** señal de pago aprobada (o free confirmada) sobre la misma inscripción.
- Si en el futuro existe un pagador distinto del participante, hará falta un campo canónico (`buyerUserId` o equivalente). Hoy **no** se inventa esa separación con datos de Mercado Pago.

---

## Audiencias evaluables

| Key / tipo | Evaluable | Reason code típico |
|------------|-----------|--------------------|
| `EDITION_PARTICIPANTS` | Sí | `EDITION_PARTICIPANT` |
| `CONFIRMED_REGISTRATION` / `CONFIRMED_EDITION_PARTICIPANTS` | Sí | `CONFIRMED_EDITION_PARTICIPANT` |
| `PRODUCT_PURCHASERS` / `EDITION_PURCHASERS` | Sí (proxy) | `EDITION_PURCHASER` |
| `CATEGORY` / `CATEGORY_PARTICIPANTS` | Sí (con `metadata.categoryId`) | `CATEGORY_PARTICIPANT` |
| `WINNERS` | Sí | `WINNER` |
| `MANUAL_USERS` | Sí (si `manualUserId` conocido) | `MANUAL_USER` |

## Audiencias diferidas / no evaluables

| Key | Motivo |
|-----|--------|
| `ALL_USERS` | Sin fuente acotada segura |
| `ORGANIZATION_MEMBERS` | Sin membresía canónica en Clickatón |
| `FINALISTS` | Sin enlace registration↔resultado |
| `STAFF` | Sin roster confiable |
| `CUSTOM_FUTURE` / `CUSTOM_GROUP` genérico | No evaluable automático |
| Categoría sin `categoryId` | `SKIPPED_NO_SOURCE` |

---

## Política de identidad

Orden:

1. `userId` persistido en inscripción / premio, si existe en `User`.
2. Email exacto normalizado (`trim` + lower) con **exactamente un** `User` match (case-insensitive).
3. No resolver.

Prohibido: nombre, Instagram, teléfono, coincidencia parcial, emails ambiguos, crear usuarios.

Caso sin identidad: elegible + `materializable: false` + `PENDING_IDENTITY` / reason `MISSING_CANONICAL_USER`.

---

## Servicios creados

### `@repo/partners`

- `evaluateBenefitEligibility` / `evaluateBenefitAudience`
- `listEligibleSubjects` / `explainBenefitEligibility`
- `buildBenefitAccessSyncPlan` / `planFromEvaluation` / `summarizeSyncPlan`
- `canUserAccessBenefit` / `listAccessibleBenefitsForUser` / `getBenefitAccessExplanation`
- Access keys: `manual:…` / `auto:…` / `pending:…`

### Clickatón

- `loadClickatonEligibilitySnapshot`
- `previewBenefitAccessSync` / `applyBenefitAccessSync` / `syncEditionBenefitAccess`
- Server actions: preview / apply por beneficio; sync por edición
- UI en detalle de participación + botón en listado de edición

---

## Modelo de access

`DnxPartnerBenefitAccess` ampliado:

- `accessKey` (único, idempotencia)
- `source` MANUAL | AUTOMATIC
- `sourceType`, `sourceId`, `reasonCode`
- `grantedAt`, `revokedByUserId`, `metadata`
- `userId` nullable (pending identity)
- statuses: ACTIVE, REVOKED, EXPIRED, PENDING_IDENTITY, SKIPPED

`DnxPartnerBenefitSyncRun` para auditoría de corridas y soft-lock.

### Migración

`packages/db/prisma/migrations/20260803120000_dnx_partner_benefit_eligibility/migration.sql`

- Aditiva; backfill `accessKey = manual:{benefitId}:{userId}` para filas existentes.
- **No aplicada en producción** en esta tarea.
- Compatibilidad: grants manuales Stage 02 Imp 01 siguen válidos como `source=MANUAL`.

---

## Sincronización

| Modo | Escrituras |
|------|------------|
| Preview | No (solo plan + audit + SyncRun COMPLETED) |
| Apply | Upsert grants automáticos, revoke automáticos inelegibles, upsert PENDING_IDENTITY |
| Edición | Recorre beneficios ACTIVE de participaciones de la edición; error parcial no aborta el lote |

**Automatizaciones:** diferidas. No hay eventos canónicos estables sin riesgo (confirmación / pago / ganador) cableados aquí. Reutilizar el servicio cuando existan hooks confiables. Sin cron improvisado.

---

## Revocación

- Solo accesos `source=AUTOMATIC` dejan de ser deseados.
- Manuales nunca en `toRevoke` del plan.
- Soft revoke (`REVOKED` + timestamps); sin delete físico.
- Beneficio pausado/vencido: no materializa nuevos; puede marcar revocación automática de vigentes según plan (`BENEFIT_NOT_ACTIVE`). Acceso histórico permanece.

---

## Idempotencia y concurrencia

- Clave única `accessKey`.
- Re-sync → KEEP si ya ACTIVE.
- Soft-lock: SyncRun `RUNNING` reciente (<5 min) por beneficio bloquea otro APPLY.
- Upsert Prisma / memory repo por `accessKey`.

---

## Consulta efectiva

- `canUserAccessBenefit` / `listAccessibleBenefitsForUser`
- Considera accesos ACTIVE (manual o automático), vigencia y status del beneficio.
- Un usuario puede tener varios rows (manual+auto); el derecho efectivo es único (`hasAccess` booleano).

---

## UI administrativa

En `/admin/ediciones/[editionId]/sponsors/[participationId]`:

- Bloque Elegibilidad (audiencia, contadores, última sync)
- Preview / Sincronizar accesos
- Tabla de accesos (origen, motivo, estado, fechas, fuente)
- Grant manual con **motivo obligatorio**

En listado de edición: **Sincronizar beneficios**.

Sin datos financieros del sponsor en esta vista.

---

## Permisos

Nuevos en `DnxPartnerCapability`:

- `PARTNER_BENEFITS_VIEW_ELIGIBILITY`
- `PARTNER_BENEFITS_SYNC_ACCESS`
- `PARTNER_BENEFITS_REVOKE`
- `PARTNER_BENEFITS_VIEW_ACCESS`

(+ existentes GRANT / VIEW / MANAGE). Ops admin recibe el bundle completo.

---

## Auditoría / observabilidad

Acciones: `eligibility.preview`, `eligibility.sync_apply`, `eligibility.sync_edition`, `benefit_access.grant_*`, `benefit_access.revoke_*`.

Logs JSON: `scope=dnx_partners_eligibility` con ids y contadores; sin tokens, pagos ni PII completa.

---

## Riesgos

1. Proxy de comprador ≠ pagador MP real.
2. Finalistas diferidos.
3. Soft-lock de sync no es advisory lock DB (race residual posible).
4. Email case-insensitive asume unicidad de email en `User`.
5. Migración pendiente de aplicar en cada entorno.

## Deuda técnica

- Eventos automáticos post-confirmación / premio.
- FK finalistas Clickatón↔FotoRank.
- `buyerUserId` canónico si el producto lo exige.
- Pantalla pública / FotoOffice (próxima etapa).

---

## Próxima implementación recomendada

**ETAPA 02 — IMPLEMENTACIÓN 03 (o FotoOffice):** exposición controlada de beneficios accesibles al usuario autenticado (consulta efectiva ya lista), sin redención QR todavía; o cablear hooks de sync en confirmación de inscripción / prize assignment.

---

## Acción legal (recordatorio)

Antes de publicar beneficios reales: checklist de elegibilidad, vigencia, límites, revocación, responsabilidad partner/DNX, datos personales, comprador≠participante, cancelaciones, ganadores, accesos manuales, no transferencia. Sin contratos definitivos en esta etapa.
