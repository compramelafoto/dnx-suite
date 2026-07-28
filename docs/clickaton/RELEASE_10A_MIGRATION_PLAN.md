# RELEASE 10A — Plan de migraciones Clickatón

**Fecha:** 2026-07-28  
**Fuente:** `packages/db/prisma/migrations/` + `schema.prisma`  
**Regla 10A:** validar; **no** aplicar en producción.

## Estado de validación en esta auditoría

| Paso | Resultado |
|------|-----------|
| Prisma generate | OK |
| `prisma migrate status` vs Neon `packages/db/.env` | **FAIL** — `P1001` host unreachable |
| Docker Postgres local | **NO** — `docker` CLI ausente |
| Migración limpia + seed + rollback | **NO EJECUTADO** (sin DB temporal autorizada alcanzable) |
| Aplicar producción | **NO** (prohibido en 10A) |

**Veredicto migraciones:** **BLOCKED** para “validadas end-to-end desde cero” hasta disponer de DB temporal/staging alcanzable.

---

## Cadena relevante (orden Prisma)

Pre-requisitos ya históricos (contexto):

1. `20260718120000_clickaton_editions_and_venues`
2. `20260718220000_clickaton_registrations_credentials_checkin_kits`
3. `20260722220000_add_financial_identity_and_economic_agreements`
4. `20260722230000_add_encrypted_credentials_and_legacy_mp_fields`
5. `20260723120000_dnx_clickaton_mp_oauth_state`

Etapas inscripción / release candidate:

| # | Migración | Modelos / tablas | Depende de | Únicos / índices críticos | Backfill | Reversible | Bloqueo tabla | Riesgo datos | Local | Staging | Prod |
|---|-----------|------------------|------------|---------------------------|----------|------------|---------------|--------------|-------|---------|------|
| 1 | `20260728010000_clickaton_edition_commercial_fields` | `ClickatonEdition` (+`registrationEnabled`, geo, `paymentBeneficiaryConfig`) | editions base | idx `registrationEnabled` | No (defaults) | Parcial (DROP COLUMN) | Bajo (ADD COLUMN nullable/default) | Bajo | ? | ? | **No aplicar 10A** |
| 2 | `20260728020000_clickaton_registration_price_phases` | `ClickatonRegistrationPricePhase`; FK en registration | #1 | idxs por edition/fechas/prioridad | No | Parcial | Bajo | Bajo | ? | ? | No |
| 3 | `20260728030000_dnx_promotions` | `DnxPromotion`, `DnxPromotionRedemption`; cols registration | #2 | **UNIQUE** `code`, **UNIQUE** `idempotencyKey` | No | Parcial | Bajo | Medio si códigos duplicados al backfill futuro | ? | ? | No |
| 4 | `20260728040000_clickaton_merch_fulfillment` | variants + fulfillment en `ClickatonRegistrationItem` | merch/product base | idxs fulfillment | No | Parcial | Bajo | Bajo | ? | ? | No |
| 5 | `20260728050000_clickaton_edition_finance_soft_refs` | soft refs agreement/distribution + `ClickatonEditionFinanceAudit` | financial identity | idxs agreement | No | Parcial | Bajo | Bajo (soft refs) | ? | ? | No |
| 6 | `20260728060000_dnx_payment_order_allocation` | `DnxPaymentOrderAllocation` | payments core + finance | **UNIQUE** idempotency; **UNIQUE** (order, beneficiary, version) | No | Parcial | Bajo (CREATE) | Bajo | ? | ? | No |
| 7 | `20260728070000_clickaton_fotorank_sync` | edition/registration sync cols; `FotorankContestParticipant`; `ClickatonFotoRankSync`; outbox | edition + FR contest | **UNIQUE** participant pairs; sync idempotency | No | Parcial | Medio (varias CREATE) | Medio si FR contest ausente | ? | ? | No |
| 8 | `20260728080000_clickaton_welcome_cards` | `DnxMediaAsset`, `DnxWelcomeCard`; status cols + cast `profilePhotoStatus` | #7 | **UNIQUE** storage key; welcome template key | No | Difícil (enums+cast) | **Medio-alto** (`ALTER … TYPE … USING` puede reescribir `ClickatonRegistration`) | **Medio** (valores no mapeados → `PENDING`) | ? | ? | No |
| 9 | `20260728090000_dnx_social_publisher` | `DnxSocialAccount`, grants, publish requests, etc. | identity | **UNIQUE** platform+externalAccount | No | Parcial | Medio | Bajo | ? | ? | No |
| 10 | `20260728100000_clickaton_timeline_prompts` | timelines, events, prompts, capability grants | edition | uniques por diseño timeline | No | Parcial | Medio | Bajo (seed AR crea timeline) | ? | ? | No |
| 11 | `20260728180000_clickaton_price_phase_products_and_store` | `ClickatonPricePhaseItem`, store fields, media, inventory movements | #2 + catalog products | **UNIQUE** phase+product; storeSlug; inventory idempotency | Seed AR (phase items) | Difícil (`ADD VALUE` enums) | Bajo-medio | Bajo-medio (`sourceType` default `TICKET_BASE`) | ? | ? | No |

### Migraciones FotoRank en la misma cola (REVISAR / acoplamiento)

| Migración | Nota release Clickatón | Riesgo |
|-----------|------------------------|--------|
| `20260728120000_fotorank_p0_01_registration_rules_fee_assets` | WIP/FR P0 — **entre** timeline y phase products | Bajo Clickatón; `ADD VALUE` enum irreversible |
| `20260728140000_fotorank_p0_06_entry_upload_exif_checklist` | DROP INDEX + DROP COLUMN `bucket`/`byteSize` + rewrite uniques | **Alto** si hay entries/assets reales; backfill FR obligatorio; lock alto |
| `20260728160000_fotorank_p0_07_jury_anonymization_rules_storage` | Tabla conflictos jurado | Bajo; comentario SQL: no Neon con drift |

**Riesgo:** Prisma exige orden lineal. Un `migrate deploy` en DB compartida aplicará FR P0 si aún no están. Decidir en 10B si la DB de Clickatón staging/prod es compartida con FotoRank.

**Huecos de timestamp (normales):** no existen `…8110000`, `…8130000`, `…8150000`, `…8170000`.

Detalle ampliado por [Audit migrations Clickaton](85b08452-9aae-4493-9987-2b3244149237).

---

## Estimación técnica (interna, no comunicar SLAs)

| Migración | Estimación técnica |
|-----------|--------------------|
| commercial fields / price phases / merch soft alters | segundos–bajo minuto en tablas chicas |
| promotions + allocations CREATE | bajo minuto |
| fotorank sync + welcome + social + timeline | 1–5 min según tamaño DB / locks DDL |
| FR P0 entry upload (DROP INDEX + rewrite columns) | **mayor** — revisar datos FR existentes |
| phase products + inventory | bajo–medio minuto |

---

## Plan de validación autorizada (10B prep)

Ejecutar en **DB temporal** o Neon branch **no productiva**:

```bash
# 0) Aislar URL (nunca producción)
export DATABASE_URL='postgresql://…temporal…'

# 1) Limpia + migrate
pnpm --filter @repo/db exec prisma migrate reset --force
# o: createdb + prisma migrate deploy

# 2) Generate ya cubierto por postinstall
pnpm --filter @repo/db db:generate

# 3) Seed Clickatón (idempotente)
CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026
CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026  # 2ª vez

# 4) Selfchecks dominio
pnpm --filter clickaton selfcheck:price-phases
pnpm --filter clickaton selfcheck:edition-finance
pnpm --filter clickaton selfcheck:fotorank-sync
pnpm --filter clickaton selfcheck:welcome-card
pnpm --filter clickaton selfcheck:timeline
pnpm --filter clickaton selfcheck:included-merch-variants

# 5) Rollback lógico (no down migration Prisma): flags OFF
# registrationEnabled=false, sync disabled, social publish gated
```

### Seed scripts

| Script | Rol |
|--------|-----|
| `apps/clickaton/scripts/seed-argentina-2026-edition.ts` | Edición AR 2026 + grants finance |
| `apps/clickaton/scripts/seed-pilot-edition-test.ts` | Piloto TEST |
| `packages/db` `db:seed` | seed general monorepo (no específico AR) |

---

## Criterios GO para 10B (DB)

- [ ] migrate deploy OK en staging
- [ ] `_prisma_migrations` incluye cadena Clickatón hasta `…18180000…`
- [ ] seed AR 2026 idempotente
- [ ] `registrationEnabled=false` / sin venta LIVE
- [ ] decisión explícita sobre migraciones FR P0 en la misma DB
