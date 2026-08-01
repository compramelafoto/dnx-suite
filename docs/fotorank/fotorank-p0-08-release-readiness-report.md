# FotoRank P0-08 — Staging, R2 real, E2E y release readiness

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD observado:** `aa92de8` (+ working tree local)  
**Resultado Go/No-Go:** **NO-GO** para apertura productiva el 1 ago 2026  
**Confirmación:** no hubo commit, push ni deploy a producción; Neon productiva no migrada.

---

## 1. Preflight

| Check | Resultado |
|-------|-----------|
| Repo | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` |
| Working tree | Cambios propios FR + ajenos (Clickatón/InfoSpot) **no tocados** |
| Neon en `.env` | Presente → **bloqueado** por guard |
| DB local | Homebrew Postgres; DBs `fotorank_staging_2026`, `fotorank_p0_08_from_zero`, `fotorank_p0_08_incremental` |
| R2 prod | `fotorank-uploads` (protegido, no usado) |
| Vercel | Proyecto `fotorank-dnxsuite`; preview reciente ERROR (ajeno) |
| Guard migraciones | `apps/fotorank/scripts/assert-safe-database-url.ts` PASS en localhost aislado |

### Inventario de variables (sin secretos)

DB · auth · URL pública · email (opcional) · R2 staging · TTL signed · `FOTORANK_APP_ENV` · seed users (`admin@`, `participante1/2@`) · jurados/organizadores de prueba vía fixtures integración.

---

## 2. DB staging

| DB | Uso |
|----|-----|
| `fotorank_staging_2026` | Staging operativo local |
| `fotorank_p0_08_from_zero` | Prueba migrate deploy completo |
| `fotorank_p0_08_incremental` | Pre-P0 → P0-01/06/07 |

Aislada de Neon prod, Clickatón drift y CLF/InfoSpot productivas.

---

## 3. Estrategia de migraciones

- Procedimiento: `prisma migrate deploy` vía `db:migrate:isolated` (nunca `db push` final).
- Desde cero: **PASS** (81 migraciones, incluye P0-01/06/07).
- Incremental: stash temporal P0 → migrate 78 → marcador User → restore P0 → migrate 3 → marcador + tablas P0 **PASS**.
- Migración P0-08 de schema: **no requerida**.
- `prisma format --check`: warning preexistente (no reformateado para no tocar schema ajeno).

---

## 4. R2

| Ítem | Estado |
|------|--------|
| Catalog `stagingBucket` | `fotorank-private-staging` en `services/dnx-mcp/.../fotorank.ts` |
| MCP `r2_staging_plan` | Devolvió `stagingBucket: null` (proceso MCP desactualizado o sin reload) |
| Credenciales locales | Ausentes → `test:storage:r2-staging` = **SKIP** |
| Provider activo | `local` privado |

---

## 5. Privacidad del original

Selfcheck `test:privacy:original` **PASS**: jurado/visitante/cross-user/cross-org denegados; keys sin PII; payload jury sin `storageKey`.  
Prueba R2 pública directa: **BLOCKED** (sin bucket staging).

---

## 6–9. Funnel / roles

| Flujo | Resultado |
|-------|-----------|
| FREE inscripción (sin payment order) | PASS integración |
| Upload + EXIF + checklist + confirm + replace | PASS (`entries.integration`) |
| Sin EXIF no bloquea | PASS (política P0-06 + integración) |
| Organizador métricas/revisión | PASS (`jury.integration` + dominio) |
| Jurado preview / sin original / COI | PASS |
| Browser E2E landing→participar | **NOT RUN** |

---

## 10. Bases

- Seed publica placeholder a propósito (staging).
- Gate `placeholder-gate` **PASS** (bloquea prod con placeholder).
- UI admin bases (P0-07) lista para texto oficial.
- Decisiones humanas: ver `santa-fe-en-foco-pending-decisions.md`.

---

## 11–12. Configuración y fechas

- Seed timezone → `America/Argentina/Cordoba`.
- Ventanas ART 1 ago–30 sep (propuesta).
- `test:timezone:selfcheck` **PASS** (borde −1s / open / close / +1s).

---

## 13–15. Correos, observabilidad, errores

- Outbox mock + templates mínimos (5 kinds); no bloquea inscripción.
- `frLog` en inscripción (redact secrets).
- Mensajes dominio existentes (sin stacks SQL/AWS en UI).

---

## 16–17. Reintentos / huérfanos

- Advisory lock `pg_advisory_xact_lock` en create registration → concurrencia **PASS** (10/10).
- `test:release:orphan-assets` lista sin borrar.

---

## 18–19. Métricas y Public API

- Métricas integración jury coinciden en fixture.
- Allowlist Public API **PASS** (sin email/phone/rulesData/storageKey).

---

## 20. Carga básica

- 10 inscripciones concurrentes: **PASS** tras fix lock (58ms).

---

## 21. Tests ejecutados

| Test | Resultado |
|------|-----------|
| assert-safe-database-url | PASS |
| migrate from zero | PASS |
| migrate incremental P0 | PASS |
| seed bootstrap + santa-fe | PASS |
| registration/entries/jury selfcheck | PASS |
| registration/entries/jury integration | PASS |
| timezone / privacy / allowlist / placeholder-gate | PASS |
| r2-config | PASS (configured=false esperado) |
| r2-staging | SKIP (bloqueador externo) |
| concurrency smoke | PASS |
| orphan-assets | PASS |
| prisma validate | PASS |
| prisma format --check | FAIL preexistente |
| typecheck / lint / build / Playwright E2E | NOT RUN (tiempo/ambiente) |

---

## 22. Bloqueadores

1. R2 staging real + credenciales  
2. Bases oficiales (humano)  
3. Decisiones categorías/reglas técnicas (humano)  
4. Email provider real  
5. Preview Vercel FotoRank healthy  
6. E2E browser de lanzamiento  

---

## 23. Decisiones humanas pendientes

Ver [`santa-fe-en-foco-pending-decisions.md`](./santa-fe-en-foco-pending-decisions.md).

---

## 24. Go/No-Go

**NO-GO** apertura productiva.  
**GO parcial** para seguir QA en Postgres local + storage local, con checklist/runbook listos.

---

## 25. Próximo paso recomendado

**P0-08b / ops:** materializar bucket `fotorank-private-staging`, cargar `FOTORANK_R2_*` en Preview, ejecutar `test:storage:r2-staging` PASS, Playwright smoke en staging URL, publicar bases oficiales, luego re-evaluar Go/No-Go.  
**No** iniciar rúbricas/votos/ranking todavía.

---

## Archivos clave creados/modificados (P0-08)

- `apps/fotorank/scripts/assert-safe-database-url.ts`
- `apps/fotorank/scripts/migrate-fotorank-isolated.ts`
- `apps/fotorank/scripts/migrate-incremental-p0.ts`
- `apps/fotorank/scripts/seed-bootstrap-admin.ts`
- `apps/fotorank/app/lib/fotorank/observability/structured-log.ts`
- `apps/fotorank/app/lib/fotorank/notifications/outbox.ts`
- `apps/fotorank/app/lib/fotorank/timezone/*`
- `apps/fotorank/app/lib/fotorank/security/*`
- `apps/fotorank/app/lib/fotorank/storage/r2-staging.smoke.ts`
- `apps/fotorank/app/lib/fotorank/storage/orphan-assets-report.ts`
- `apps/fotorank/app/lib/fotorank/release/*`
- `apps/fotorank/app/lib/fotorank/registration/registration-service.ts` (frLog + advisory lock)
- `packages/db/prisma/scripts/seed-santa-fe-en-foco.ts` (timezone Cordoba)
- `services/dnx-mcp/src/platforms/platforms/fotorank.ts` (stagingBucket)
- Docs: checklist, runbook, pending decisions, este reporte
