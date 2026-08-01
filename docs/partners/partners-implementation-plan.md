# DNX Partners — Plan de implementación por fases

**Fecha:** 2026-08-01  
**Etapa actual:** 01 / Implementación 01 — Dominio central (**DONE** — ver `PARTNERS_STAGE_01_IMPLEMENTATION_01_RESULT.md`)  
**Siguiente:** Etapa 02 — Beneficios + elegibilidad FotoOffice

---

## Principios de ejecución

1. Sin pagos automáticos, sin MP links, sin suscripciones.
2. Sin publicar beneficios reales hasta checklist legal.
3. Sin borrar ni migrar a la fuerza modelos legacy.
4. Schema aditivo; soft archive.
5. Package `@repo/partners` antes de UI compleja.
6. Clickatón admin primero; FotoOffice read-path segundo.

---

## Fase 0 — Auditoría (esta entrega)

**Estado:** DONE

Entregables:

- [x] `docs/partners/partners-audit.md`
- [x] `docs/partners/partners-domain-proposal.md`
- [x] `docs/partners/partners-integration-map.md`
- [x] `docs/partners/partners-pending-decisions.md`
- [x] `docs/partners/partners-implementation-plan.md`

---

## Fase 1 — Fundación técnica

**Estado:** DONE (2026-08-01)

**Objetivo:** modelo mínimo persistible + package + admin Clickatón CRUD básico **sin** publicación pública de beneficios.

### 1.1 Package `@repo/partners`

- Tipos/enums tipados.
- Invariantes: partner único por slug; `requiresPayment` default false.
- `evaluateAudience` puro con adapters inyectables.
- Capabilities + `assertPartnerCapability` (tests unitarios).

### 1.2 Schema Prisma aditivo (`packages/db`)

Modelos:

- `DnxPartner`
- `DnxPartnerParticipation`
- `DnxPartnerContribution`
- `DnxBenefit`
- `DnxBenefitAudience`
- `DnxPartnerPaymentTerms` (opcional, puede diferirse a 1.4)
- `DnxPartnerGrant` (o equivalente)

Migración **aditiva**. Sin tocar payments.

### 1.3 Admin Clickatón

- Reemplazar placeholder `/admin/sponsors`.
- CRUD Partner + Participation (edición/sede).
- Contributions básicas.
- Gates: admin actual + capabilities.

### 1.4 Fuera de Fase 1

- Publicación de beneficios a usuarios finales.
- MP / PaymentTerms automatizados.
- Migración CLF OrganizerLandingSponsor.
- Portal partner.

### Archivos previstos (Fase 1)

```
packages/partners/**                                     # NUEVO
packages/db/prisma/schema.prisma                         # modelos nuevos
packages/db/prisma/migrations/<timestamp>_dnx_partners/** # NUEVO
docs/partners/**                                         # actualizar estado
apps/clickaton/app/admin/(panel)/sponsors/**             # UI real
apps/clickaton/lib/admin/partners/**                     # NUEVO
apps/clickaton/package.json                              # dep @repo/partners
pnpm-workspace / turbo si aplica
```

---

## Fase 2 — Beneficios + elegibilidad

**Objetivo:** beneficios publicables con audiencias simples; consumo FotoOffice read-only.

- CRUD Benefit + Audience en admin.
- Link opcional a `DnxPromotion`.
- Adapter FotoOffice: listar beneficios aplicables al User.
- Redención manual mínima (opcional ledger).
- **Gate legal:** checklist L-* en pending-decisions antes de PUBLISHED real.

### Archivos previstos

```
apps/fotoffice/app/**/beneficios/**
apps/fotoffice/lib/partners/**
apps/clickaton/lib/admin/partners/benefits/**
packages/partners/src/eligibility.ts
packages/partners/src/benefit.ts
```

---

## Fase 3 — Bridges de producto

**Objetivo:** dejar de duplicar texto de sponsors/premios donde duela.

| App | Trabajo |
|-----|---------|
| Clickatón | `prisma-source` carga participaciones públicas; bridge prize bundle |
| FotoRank | Selector Partner en premios/publicación; legacy `sponsorsText` coexistente |
| CLF | Vínculo opcional OrganizerLandingSponsor → DnxPartner |
| InfoSpot | Canal de difusión autorizado (solo lectura) |

---

## Fase 4 — PaymentTerms opcionales (manual)

**Objetivo:** registrar cobros acordados **sin** automatizar MP.

- CRUD PaymentTerms.
- Estados manuales PENDING/PAID/WAIVED.
- Soft-link FI / EconomicAgreement.
- Capabilities `partner.payment_terms.manage` + finance grants para montos sensibles.

**No incluye:** preferencias MP, cuotas auto, recurrencias.

---

## Fase 5 — Portal / self-service (opcional futuro)

- Partner ve su ficha y aportes.
- No ve datos de otros partners.
- Connect MP solo si ya tiene finance grant (composición, no fusión).

---

## Orden de decisión vs código

```
Fase 0 docs          ← ahora
Decisiones P-01/02, D-05, $01–$03, L-gate
Fase 1 schema+admin
Fase 2 benefits+FO
Fase 3 bridges
Fase 4 payment terms manual
Fase 5 portal
```

---

## Criterios de aceptación Fase 1

1. Se puede crear Tecnoflash como `DnxPartner` sin campos de pago.
2. Se puede crear participación Clickatón edición con `requiresPayment=false`.
3. Se puede registrar contribution SERVICE/DISCOUNT con descripción libre.
4. Admin Clickatón lista/edita partners sin tocar finanzas MP.
5. Typecheck del package `@repo/partners` + app Clickatón verde.
6. Ninguna migración destructiva; ningún email; ningún deploy requerido para validar en local/staging.

---

## Criterios de aceptación Fase 2 (preview)

1. Beneficio “descuento limpieza socios SFPR” con audience ORGANIZATION_MEMBERS.
2. Usuario elegible lo ve en FotoOffice; no elegible no.
3. Publicar beneficio exige `partner.benefit.publish` + termsSummary no vacío (aunque el contrato legal viva fuera).
4. No se crea `DnxPaymentOrder` al publicar.

---

## Verificaciones recomendadas por fase

| Fase | Checks |
|------|--------|
| 0 | Review docs (humano) |
| 1 | `pnpm` typecheck package + clickaton; tests permissions/eligibility unit |
| 2 | Selfcheck eligibility adapters; smoke UI FO |
| 3 | Smoke público maratón / landing FR |
| 4 | Tests: paymentTerms no llama MP |

---

## Estado

| Ítem | Valor |
|------|-------|
| Etapa 00 Imp. 01 | DONE |
| Bloqueo código | Decisiones humanas mínimas (ver pending) |
| Próxima implementación | Fase 1 — `@repo/partners` + schema + admin Clickatón |
