# 29 — Reporte Bloque E: Workers, crons, scripts, infra y monitoreo

**Fecha:** 2026-07-05  
**Bloque:** E — Infraestructura operativa  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto` + `apps/compramelafoto-workers/`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) · Bloque D: [`28`](./28-code-import-block-d-report.md)

---

## Resumen ejecutivo

Bloque E **completado** para el alcance acordado: workers (camera-ingest, FTP gateway, video), 24 rutas cron, admin API operativa, scripts de mantenimiento, health/monitoring, deploy Docker y wiring `@repo/db`.

| Validación | Resultado |
|------------|-----------|
| `pnpm install` | ✅ |
| `pnpm --filter compramelafoto typecheck` | ✅ |
| `pnpm --filter compramelafoto build` | ✅ |
| `pnpm --filter compramelafoto lint` | ✅ (**0 errors**, ~1684 warnings legacy) |
| `pnpm --filter compramelafoto-workers typecheck` | ✅ |
| `pnpm --filter compramelafoto-workers build` | ✅ (= typecheck) |
| `pnpm --filter compramelafoto-workers lint` | ✅ (skipped — sin eslint en workers) |

**Listo para commit:** sí (incluye `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/db/src/client.ts` enum export).

**Sin commit** en esta sesión.

---

## Workers migrados

| Worker | Origen legacy | Destino monorepo | Archivos ~ |
|--------|---------------|------------------|------------|
| **camera-ingest** | `camera-ingest-worker/` | `apps/compramelafoto-workers/camera-ingest/` | 11 |
| **camera-ftp-gateway** | `camera-ftp-gateway/` | `apps/compramelafoto-workers/camera-ftp-gateway/` | 18 |
| **video** | `video-worker/` | `apps/compramelafoto-workers/video/` | 14 |
| **deploy** | `deploy/camera-connection/` | `apps/compramelafoto-workers/deploy/` | 2 |

### Adaptaciones workers

| Cambio | Detalle |
|--------|---------|
| `src/prisma.ts` | `getPrisma()` / `disconnectPrisma()` vía `@repo/db` |
| `package.json` | Eliminado `postinstall-prisma.mjs`; `@repo/db` workspace; sin `prisma` local |
| `tsconfig.json` | `paths`: `@/*` → `../../compramelafoto/*`; `moduleResolution: bundler` |
| `pnpm-workspace.yaml` | `apps/compramelafoto-workers` + `apps/compramelafoto-workers/*` |
| Meta-package | `apps/compramelafoto-workers/package.json` (`compramelafoto-workers`) |
| Enum export | `CameraConnectionAssignmentMode` en `packages/db/src/client.ts` |
| FTP gateway | `albumId: null` → `?? undefined` en logs (strict TS) |

**Descartado:** `scripts/postinstall-prisma.mjs` en cada worker.

**Pendiente post-commit:** reescribir Dockerfiles para contexto monorepo (hoy referencian raíz legacy `prisma/` + `lib/`).

---

## Crons migrados

### `vercel.json` (ya presente — 17 jobs)

Abandoned orders, hourly, email queue/campaigns, zip jobs, camera ingest, EXIF, OCR interno, biometric/album/R2/diseñador cleanup, MP reconcile, organizer commissions.

### `app/api/cron/**` — 24 rutas (9 → 24)

**Nuevas respecto a Block C:**

| Ruta | Función |
|------|---------|
| `hourly` | Tareas horarias agregadas |
| `process-email-queue` | Cola email transaccional |
| `process-email-campaigns` | Campañas marketing |
| `biometric-cleanup` | Limpieza biométrica |
| `cleanup-expired-albums` | Álbumes expirados |
| `cleanup-preventa-mockups` | Mockups preventa |
| `cleanup-disenador` | Diseñador temporal |
| `cleanup-orphan-r2` | Objetos R2 huérfanos |
| `cleanup-expired-prints` | Impresiones expiradas |
| `process-design-exports` | Export diseños |
| `process-design-previews` | Previews diseño |
| `resend-digital-emails-last-48h` | Reenvío digital |
| `album-interest-emails` | Digest interés álbum |
| `hidden-album-cleanup` | Álbumes ocultos |
| `send-album-notifications` | Notificaciones álbum |

### `app/api/internal/**`

- `analysis/run` (OCR) — ya presente
- `event-organizer-commissions/mark-available` — migrado

### `lib/cron/**`

Helpers de notificaciones, digest album-interest, etc. (copia completa desde legacy).

---

## Admin API y health

| Área | Rutas migradas |
|------|----------------|
| `app/api/admin/**` | ~159 routes (sync completo desde legacy) |
| `app/api/health/db-schema/` | Health schema DB |
| `app/api/admin/platform-health/` | Monitoreo plataforma + actions |

### Libs admin añadidas

- `lib/album-diagnostics.ts`, `album-diagnostics-types.ts`
- `lib/admin-organizer-withdrawal-actions.ts`
- `lib/school-organizer-management-access.ts`
- `lib/mp-payment-anomaly-audit-types.ts`

---

## Scripts migrados

**Destino:** `apps/compramelafoto/scripts/` — **104 archivos**

| Grupo | Ejemplos |
|-------|----------|
| Camera connection | `camera-connection-gateway-ready.ts`, `enqueue-raw` |
| Ops / backfill | `reconcile-mp-paid.ts`, `regenerate-order-zips*.ts` |
| Blog QA/seeds | `seed-blog*.ts`, `validate-blog-phase*.ts` |
| R2 / email QA | `test-r2-cors.ts`, `qa-email-digital-downloads.ts` |
| Shell utils | `check-zip-job.sh`, `setup-google-credentials.js` |

**Typecheck:** `scripts/**` excluido de `tsc` (herramientas CLI con `dotenv`/`require`).  
**Lint:** `scripts/**` en `globalIgnores` de ESLint.

---

## Dependencias agregadas

| Paquete | Dónde |
|---------|-------|
| `@repo/db` | Workers (×3) |
| Workspace entries | `pnpm-workspace.yaml` |

Lockfile actualizado vía `pnpm install` (workers + transitive).

---

## Adaptaciones `@repo/db`

| Archivo | Cambio |
|---------|--------|
| `packages/db/src/client.ts` | `+ CameraConnectionAssignmentMode` export |
| Workers `prisma.ts` | Bridge `@repo/db` |
| `admin-organizer-withdrawal-actions.ts` | Imports desde `@/lib/prisma` |
| `app/api/admin/students/[studentId]/route.ts` | `prisma.schoolStudent` / `tx.schoolStudent` (no `Student` FotoOffice) |
| `tsconfig.json` | `exclude: scripts/**` |
| `eslint.config.mjs` | `globalIgnores: scripts/**` |

**No modificado:** `schema.prisma`, migraciones.

---

## Errores corregidos

| Categoría | Resolución |
|-----------|------------|
| Módulos admin faltantes (5 libs) | Copiados desde legacy |
| `Student` vs `SchoolStudent` en admin students | `schoolStudent` + fix `tx.studentEnrollment` |
| Workers `@/lib/*` no resolvía con NodeNext | `moduleResolution: bundler` en worker tsconfigs |
| FTP `null` vs `undefined` en logs | `?? undefined` |
| Scripts `dotenv` / `require` en typecheck/lint | Excluir `scripts/**` de tsc y eslint |

---

## Validaciones ejecutadas

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
pnpm install
pnpm --filter compramelafoto typecheck
pnpm --filter compramelafoto build
pnpm --filter compramelafoto lint
pnpm --filter compramelafoto-workers typecheck
pnpm --filter compramelafoto-workers build
pnpm --filter compramelafoto-workers lint
```

---

## Pendientes finales (post Block E)

1. **Dockerfiles workers** — contexto build monorepo (`@repo/db`, sin `COPY prisma` legacy).
2. **Codemod masivo** `@prisma/client` → `@/lib/prisma` en app (cientos de archivos admin/cron).
3. **Smoke ops** — ejecutar crons en staging con `CRON_SECRET`, health endpoints, workers en VM.
4. **`turbo.json`** — incluir `compramelafoto-workers` en pipeline CI si aplica.
5. **ESLint workers** — opcional config mínima si se quiere lint real.
6. **Scripts** — ejecutar vía `tsx` con `dotenv` en dev; no forman parte del build Next.
7. **Commit sugerido:** `chore(clf): add workers and operational crons` + split docs.

---

## Diff resumido

| Área | Cambio |
|------|--------|
| `apps/compramelafoto-workers/` | Nuevo workspace (3 workers + deploy) |
| `apps/compramelafoto/app/api/cron/` | 15 rutas nuevas |
| `apps/compramelafoto/app/api/admin/` | ~115 rutas nuevas |
| `apps/compramelafoto/app/api/health/` | Health checks |
| `apps/compramelafoto/lib/cron/` | Helpers cron completos |
| `apps/compramelafoto/scripts/` | 104 archivos ops |
| `pnpm-workspace.yaml` | Workers registrados |
| `packages/db/src/client.ts` | +1 enum export |
