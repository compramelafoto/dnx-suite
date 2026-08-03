# Manifiesto de commit — P0-11 (placas Clickatón)

**Fecha:** 2026-08-03  
**Branch:** `main`  
**HEAD previo:** `3dfbfa7f2dc5c9d1803b5095716ed2c8cb95c05c`  
**Objetivo del commit:** consolidar solo código P0-09/P0-10/P0-11 de placas + worker remoto.

---

## Incluidos en el commit

| ARCHIVO | CLASIFICACIÓN | INCLUIR | JUSTIFICACIÓN | RIESGO |
|---------|---------------|--------|---------------|--------|
| `services/template-render-worker/**` | PERTENECE A P0-09/P0-10/P0-11 | SÍ | Worker HMAC + Chromium + Dockerfile | Bajo |
| `apps/clickaton/lib/participant-cards/**` (mods + nuevos) | PERTENECE | SÍ | Remote provider, flags, circuit, metrics, runtime config | Bajo |
| `apps/clickaton/e2e/participant-cards-staging-matrix.spec.ts` | PERTENECE | SÍ | Matriz E2E staging | Bajo |
| `apps/clickaton/scripts/e2e-clickaton-participant-cards-*.ts` | PERTENECE | SÍ | Setup/cleanup fixtures | Bajo |
| `apps/clickaton/scripts/ops-p009-*.ts` | PERTENECE | SÍ | Probe migración + smoke R2 | Bajo |
| `apps/clickaton/scripts/lib/assert-clickaton-staging-environment.ts*` | PERTENECE | SÍ | Denylist staging | Bajo |
| `apps/clickaton/package.json` | PERTENECE | SÍ | Scripts E2E setup/cleanup/matrix | Bajo |
| `apps/clickaton/.env.example` (solo bloque placas) | PERTENECE | SÍ | Documenta flags sin secretos | Bajo |
| `apps/clickaton/app/(public)/mi-cuenta/inscripciones/[id]/page.tsx` | PERTENECE | SÍ | UX V2 fail-closed | Bajo |
| `apps/clickaton/app/admin/(panel)/inscripciones/[registrationId]/page.tsx` | PERTENECE | SÍ | Admin flag V2 | Bajo |
| `apps/clickaton/lib/admin/edition-partners/service.ts` (solo fix `null→undefined`) | DEUDA PREEXISTENTE | SÍ (parche mínimo) | Desbloquea typecheck ParticipationRecord | Bajo |
| `packages/db/prisma/migrations/20260801140000_*/apply-idempotent-staging.sql` | PERTENECE | SÍ | Apply residual staging | Bajo |
| `docs/clickaton/clickaton-participant-cards-*.md` | PERTENECE | SÍ | Persistencia + staging runbook/readiness + manifiesto | Bajo |
| `docs/template-engine/template-render-worker.md` | PERTENECE | SÍ | Deploy/HMAC/health | Bajo |
| `pnpm-lock.yaml` (importer worker) | PERTENECE | SÍ | Lock del nuevo package | Bajo |

---

## Excluidos (no incluir)

| ARCHIVO / ÁREA | CLASIFICACIÓN | INCLUIR | JUSTIFICACIÓN |
|----------------|---------------|---------|---------------|
| `.local/clickaton-participant-cards-e2e/**` | SENSIBLE | NO | Credenciales E2E |
| `.wrangler/` | TEMPORAL / SENSIBLE | NO | Estado local Cloudflare |
| `packages/db/.data/**` | GENERADO / SENSIBLE | NO | Binarios media |
| `packages/e2e/artifacts/**` | GENERADO | NO | Logs/traces MCP |
| `apps/clickaton/lib/partners-auto-sync/**` | CAMBIO AJENO | NO | Partners eligibility sync |
| `apps/clickaton/app/admin/**/sponsors/**` | CAMBIO AJENO | NO | Partners UI |
| `packages/partners/**` (nuevos eligibility/assets) | CAMBIO AJENO | NO | Fuera de alcance placas |
| `packages/db/prisma/migrations/20260802160000_*` y posteriores partners | CAMBIO AJENO | NO | Migraciones partners |
| `packages/db/prisma/schema.prisma` (diff partners) | CAMBIO AJENO | NO | Schema partners; modelo placas ya en HEAD |
| `turbo.json` (vars partners) | CAMBIO AJENO | NO | Env partners |
| `apps/fotoffice/**`, `apps/fotorank/**` R2/partners | CAMBIO AJENO | NO | Otras apps |
| `apps/clickaton/app/api/media/[...key]/route.ts` | CAMBIO AJENO | NO | Partners assets públicos |
| `apps/clickaton/docs/TIENDA-*`, store checkout diffs | CAMBIO AJENO | NO | Tienda |
| `docs/clickaton/ux-validation/production-*` | CAMBIO AJENO / GENERADO | NO | Auditorías prod ajenas |
| `docs/partners/**`, `docs/fotorank/santa-fe-*` | CAMBIO AJENO | NO | Otros dominios |

---

## Secret scan (candidatos)

| Hallazgo | Tipo | Acción |
|----------|------|--------|
| `.local/.../credentials.json` | SENSIBLE | Excluido (gitignored) |
| Referencias a nombres de env `R2_SECRET_*` / `HMAC` en código/docs | DOCUMENTACIÓN | OK — sin valores |
| `dev-local-hmac-secret` en README worker | EJEMPLO LOCAL | OK — no es secreto real de staging |

---

## Notas

* No se hace commit ciego del working tree.
* Producción (`clickaton-dnxsuite`) no se toca.
* Push: solo si hace falta para deploy; R2/worker runtime pueden seguir bloqueados.
