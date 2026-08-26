# DNX Partners — ETAPA 04 / IMPLEMENTACIÓN 04 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `PARTIAL`  
**Alcance:** roles institucionales + jerarquía visual + FotoRank/Clickatón (código) + migración productiva Clickatón.

---

## Decisión de entorno

Staging **fuera de alcance** para Sponsors. Trabajo sobre producción controlada.

---

## Modelo

| Dimensión | Implementación |
|-----------|----------------|
| Rol institucional | `DnxPartnerInstitutionalRole` en participación |
| Jerarquía visual | `DnxPartnerDisplayTier` (`displayTier`) |
| Orden | `displayOrder` (default 100) |
| Label público | `publicRoleLabel` (sanitizado, sin HTML) |
| Aporte | Sigue en `DnxPartnerContribution` — **no** determina el rol |

Helpers reutilizables: `packages/partners/src/institutional.ts` → `groupPartnersForPublicDisplay`, labels, normalize.

`participationType` legacy se mantiene por compatibilidad.

---

## Migración

| Ítem | Valor |
|------|-------|
| Archivo | `20260807120000_dnx_partner_institutional_roles` |
| Tipo | Aditiva (CREATE TYPE, ADD COLUMN, backfill, INDEX) |
| Comando | `pnpm --filter @repo/db partners:migrate:production -- --confirm-production-migration --backup-ref=…` |

### Identidad DB Clickatón producción (confirmada)

| Campo | Valor sanitizado |
|-------|------------------|
| Neon project | `clickaton-production` (`bitter-math-56019731`) |
| Branch | `production` |
| Host | `ep-silent-haze-awfh50a5…` |
| Database | `clickaton_production` |
| Vercel | `clickaton-dnxsuite` → maratonfotografica.com |

**No** usar `ep-round-fog` (es `dnx-suite-staging`).  
**No** usar el branch Neon llamado `production` dentro de `dnx-suite-staging`.

### Backup Neon (verificado)

| Campo | Valor |
|-------|-------|
| Name | `backup-partners-prod-pre-stage04-imp04-20260807` |
| Id | `br-damp-rain-awj86hh9` |
| Parent | `production` @ clickaton-production |
| Estado | `ready` |

Nota: se creó por error un backup homónimo en `dnx-suite-staging` (`br-calm-bonus-a4b11034`); **no** se usó para migrar.

### Migraciones aplicadas en Clickatón producción

Pendientes detectadas y aplicadas con `migrate deploy` (ambas aditivas):

1. `20260806090000_fotorank_transactional_email_outbox` — CREATE TABLE outbox (ajena, auditada: sin DROP/TRUNCATE).
2. `20260807120000_dnx_partner_institutional_roles` — roles institucionales.

Partners previos ya estaban aplicados (domain → auto-sync caps). Columnas verificadas: `institutionalRole`, `displayTier`, `displayOrder`, `publicRoleLabel`.

### FotoRank DB producción

`fotorank-dnxsuite` tiene `DATABASE_URL` propia (sensitive). En `clickaton_production` hay **0** `FotorankContest` → SFEF **no** vive en esa base.

Migración Partners en la DB de FotoRank producción: **pendiente** hasta obtener URL productiva FotoRank verificable (mismo protocolo backup + allowlist).

---

## Código

### `@repo/partners`

- Tipos + `institutional.ts` + tests (72 tests package OK).
- Service/memory normalizan rol/tier/order/label.

### Clickatón

- Admin vincular/detalle/listado con Rol / jerarquía / orden / label.
- Público: `listEditionPartnerPublicGroups` + `MarathonSponsors` agrupado.
- Adapter Prisma compartido: `@repo/db/partners-prisma-repository`.

### FotoRank

- Admin: `/dashboard/concursos/[id]/sponsors`.
- Landing: `ContestPartnersSection` + `loadContestPublicPartnerGroups`.
- Seed idempotente SFEF: ambos ORGANIZER (config oficial); contradicción CO_ORGANIZER documentada en seed.
- Link desde ContestDashboard.
- Adapter compartido: `@repo/db/partners-prisma-repository` (Clickatón re-export thin).
- Nota técnica: el adapter lleva `@ts-nocheck` temporal por drift preexistente assets/`accessKey` vs `schema.prisma` (no bloquea campos institucionales Stage 04).
- Nota ops: el store pnpm del monorepo a veces resuelve engines hacia checkouts `dnx-suite-fotorank-public-ds-01`; reinstalar en root correcto antes del deploy.

---

## Deploys

| App | Estado |
|-----|--------|
| FotoRank producción | **NO** en esta corrida — falta migrate DB FR + aislamiento WIP |
| Clickatón producción | **NO** en esta corrida — aislamiento WIP pendiente |

Flags: `DNX_PARTNER_BENEFIT_AUTO_SYNC_WRITES_ENABLED` permanece apagado (no tocado).

---

## Santa Fe en Foco

- Config vigente: SFPR + Cámara de Senadores = **organizador** ambos.
- Seed listo; **no ejecutado en prod** (contest no encontrado en DB Clickatón; falta DB FotoRank).

---

## Rollback

| Capa | Acción |
|------|--------|
| Código | Redeploy deployment Vercel anterior |
| Base | Branch Neon `br-damp-rain-awj86hh9` |
| Feature | Ocultar sección pública Partners sin borrar datos |

---

## FUTURE (no bloqueante)

QR, redención, analytics, CRM, facturación, MP Sponsors, InfoSpot, CLF, FotoOffice público, auto-sync writes, SVG, finalistas.

---

## Bloqueos restantes

```text
FOTORANK_PRODUCTION_DATABASE_URL_UNVERIFIED
FOTORANK_PROD_MIGRATE_PENDING
SFEF_SEED_PENDING_ON_FR_DB
WIP_ISOLATION_FOR_SAFE_DEPLOY
DEPLOY_FOTORANK_PENDING
DEPLOY_CLICKATON_PENDING
```

## Próxima implementación

1. Resolver URL Neon de FotoRank producción + backup + migrate institutional roles.  
2. Ejecutar `ensureSfefInstitutionalPartnersForContest`.  
3. Worktree limpio Partners-only → deploy FR luego CK.  
4. Smoke productivo.
