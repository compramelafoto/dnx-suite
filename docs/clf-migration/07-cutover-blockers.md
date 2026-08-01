# 07 — CUTOVER_P0_BLOCKERS y regresiones

**Fecha:** 2026-07-29  
**Complejidad:** S / M / L / XL (sin horas)

---

## CUTOVER_P0_BLOCKERS

### P0-01 — Panel Lab no migrado → **CLOSED** (2026-07-29, ETAPA 02)

| Campo | Valor |
|-------|-------|
| **ID** | P0-01 |
| **Estado** | **CLOSED** |
| **Dominio** | Panel Lab / Usuarios LAB |
| **Resolución** | `app/lab/**` + 11 APIs lab faltantes + `/api/terms/accept` migrados desde Legacy; post-login LAB/LAB_PHOTOGRAPHER → `/lab/dashboard` |
| **Evidencia** | `docs/clf-migration/10-stage-02-lab-migration-report.md` |
| **Pendiente humano** | Smoke staging con usuario LAB (no prod) |

### P0-02 — Cutover DB: rename `Student` → `SchoolStudent`

| Campo | Valor |
|-------|-------|
| **ID** | P0-02 |
| **Dominio** | Base de datos |
| **Descripción** | Schema mono mapea `SchoolStudent`; prod Legacy usa tabla `Student` escolar; sin migración SQL en historial |
| **Legacy** | Tabla `Student` (Int, schoolId) |
| **Monorepo** | `SchoolStudent` + `Student` FotoOffice (cuid) |
| **Archivos** | ADR-0001; `packages/db/prisma/schema.prisma`; código `prisma.schoolStudent` |
| **Riesgo** | Ruptura queries escolares / precompra / roster |
| **Solución** | Plan SQL rename + FKs + validación staging clon prod |
| **Complejidad** | **XL** |

### P0-03 — Plan de migraciones forward vs historial Legacy

| Campo | Valor |
|-------|-------|
| **ID** | P0-03 |
| **Dominio** | Base de datos / Infra |
| **Descripción** | Historiales `_prisma_migrations` incompatibles (172 vs 90); gaps staging no son replay seguro en prod |
| **Legacy** | 172 migraciones aplicadas |
| **Monorepo** | 90 gaps/suite |
| **Archivos** | `packages/db/prisma/migrations/**`, ADR D7 |
| **Riesgo** | Drift schema / tablas faltantes / apply destructivo |
| **Solución** | Checklist forward-only idempotente + freeze Legacy writes durante ventana |
| **Complejidad** | **XL** |

### P0-04 — Deploy Vercel monorepo + migrate policy

| Campo | Valor |
|-------|-------|
| **ID** | P0-04 |
| **Dominio** | Infraestructura |
| **Descripción** | Legacy corre `prisma migrate deploy` en build; Mono app build **no** debe migrar a ciegas |
| **Legacy** | `vercel-build` con migrate |
| **Monorepo** | `next build` filter; Prisma en `@repo/db` |
| **Archivos** | Legacy `package.json` scripts; mono `apps/compramelafoto/package.json`, `vercel.json` |
| **Riesgo** | Migración accidental prod o schema desfasado |
| **Solución** | Pipeline explícito: migrate controlado fuera/antes del traffic cutover |
| **Complejidad** | **L** |

### P0-05 — Workers Docker / redeploy monorepo

| Campo | Valor |
|-------|-------|
| **ID** | P0-05 |
| **Dominio** | Workers / Camera / Video |
| **Descripción** | Dockerfiles workers aún layout Legacy; runtime código migrado a `@repo/db` |
| **Legacy** | Docker standalone con `prisma/` local |
| **Monorepo** | `apps/compramelafoto-workers/*` + advertencias Dockerfile |
| **Archivos** | `apps/compramelafoto-workers/**/Dockerfile`, `deploy/README.md`, doc 30 |
| **Riesgo** | FTP ingest / video processing caídos post-cutover |
| **Solución** | Redeploy con `pnpm --filter … start` o Dockerfiles monorepo |
| **Complejidad** | **L** |

### P0-06 — Auth dual / identidad en cutover → **CLOSED** (2026-07-29, ETAPA 03)

| Campo | Valor |
|-------|-------|
| **ID** | P0-06 |
| **Estado** | **CLOSED** (código CLF) |
| **Dominio** | Auth |
| **Resolución** | SoT único `dnx_session`; sin lectura/escritura runtime de `auth-token`; logout purga Legacy; cutover = RELOGIN_REQUIRED |
| **Evidencia** | `docs/clf-migration/11-stage-03-auth-closure-report.md` |
| **No incluido** | Redirects Google Console / env Vercel → **P0-07** |

### P0-07 — Configuración env / redirects / crons en proyecto Vercel Mono

| Campo | Valor |
|-------|-------|
| **ID** | P0-07 |
| **Dominio** | Env vars / Infra |
| **Descripción** | Mismas keys, distinto proyecto; MP/Google redirects; `APP_URL` webhook; 17 crons |
| **Legacy** | Configurado prod |
| **Monorepo** | Requiere configuración humana |
| **Archivos** | `.env.example`, `vercel.json`, OAuth consoles |
| **Riesgo** | Pagos/emails/OAuth rotos |
| **Solución** | Checklist 05 + staging mirror |
| **Complejidad** | **M** |

### P0-08 — Smoke E2E crítico ausente

| Campo | Valor |
|-------|-------|
| **ID** | P0-08 |
| **Dominio** | Pruebas / Checkout |
| **Descripción** | Sin suite E2E formal; tests álbum/packs/pricing Legacy no portados (−36) |
| **Legacy** | 82 unit tests dominio |
| **Monorepo** | 61 (sesgo Cuánto Cobro/auth) |
| **Archivos** | Legacy `lib/albums/**/*.test.ts`, `lib/album-packs/**`, `lib/pricing/**` |
| **Riesgo** | Regresión venta/descarga no detectada |
| **Solución** | Portar tests críticos + checklist E2E staging (login, upload, checkout sandbox, webhook, download) |
| **Complejidad** | **L** |

---

## P1 (importante, no siempre bloquea global)

| ID | Dominio | Descripción | Complejidad |
|----|---------|-------------|-------------|
| P1-01 | Template-v2 | 10 APIs `/api/template-v2/*` fotógrafo faltantes | M |
| P1-02 | Escolar público | `student-roster` APIs públicas faltantes | M |
| P1-03 | Consent | `terms/accept` **CLOSED ETAPA 02**; quedan marketing-opt-in, revoke-face-consent | M |
| P1-04 | Print | `/api/prints/upload-final` faltante | S |
| P1-05 | Upsells | `/api/upsells/applicable` faltante | S |
| P1-06 | Comunidad pública | community-categories / upload-logo | S |
| P1-07 | Cuánto Cobro | `/api/public/cuantocobro/quotes/[token]` | S |
| P1-08 | Legal texto | Términos fotógrafo Info Spot divergente vs Legacy | M (humano) |
| P1-09 | Admin | Sync fix tope 500 fotógrafos (`e86e65ac`) | S |

---

## P2 / P3 (resumen)

- **P2:** demos/DS omitidos, lint ~1684 warnings, codemod `@prisma/client` → `@/lib/prisma`, crons solo-código sin Vercel  
- **P3:** WhatsApp test APIs, DNX 1:N, social automation, cleanup scripts ops  

---

## Working tree (contexto release)

| Bucket | ~Paths | Nota |
|--------|-------:|------|
| CLF_MIGRATION | ~30 | Auth/identity CLF |
| SHARED_REQUIRED | ~32 | `packages/auth-ui`, docs auth, lockfile |
| UNRELATED | ~75 | Clickaton, FotoRank, FotOffice… |
| UNKNOWN | ~6 | `.data/`, e2e genérico |

**No revertir / no stash.** Aislar commits de cutover CLF del WIP de otras apps.
