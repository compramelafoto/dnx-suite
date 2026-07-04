# 05 — Mapa de importación legacy → monorepo

**Fecha:** 2026-07-04  
**Origen (fuente de verdad):** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Legacy HEAD:** `6e6fd6d4` (2026-07-02)  
**Alcance:** solo planificación — **no se copia, mueve ni modifica código**

**Documentos relacionados:**

| Doc | Rol |
|-----|-----|
| [`01-current-state.md`](./01-current-state.md) | Congelar WIP monorepo antes del import |
| [`02-legacy-inventory.md`](./02-legacy-inventory.md) | Inventario cuantitativo legacy |
| [`03-prisma-diff.md`](./03-prisma-diff.md) | Diff schema / migraciones |
| [`prisma-migration-plan.md`](./prisma-migration-plan.md) | Unificación Prisma en `packages/db` |
| [`04-domain-import-plan.md`](./04-domain-import-plan.md) | Orden por dominios (5 fases) |
| [`../decisions/0001-prisma-unificado-clf-legacy.md`](../decisions/0001-prisma-unificado-clf-legacy.md) | ADR merge Prisma |

---

## Resumen ejecutivo

| Métrica | Legacy | Mono stale (`apps/compramelafoto`) |
|---------|-------:|-----------------------------------:|
| Archivos totales (excl. `node_modules`, `.next`, `.git`) | **4 846** | **~1 370** |
| Solo en legacy | **~3 561** | — |
| Solo en mono stale | — | **89** |
| En ambos (paths idénticos) | **~1 280** | **~1 280** |
| API routes | **565** | parcial / divergente |
| Páginas | **264** | parcial |
| Modelos Prisma (en legacy local) | **186** | — (usa `@repo/db`, 162 modelos) |

**Decisión previa al import:** archivar la copia stale del monorepo (no usarla como base):

```
apps/compramelafoto  →  apps/_archive/compramelafoto-monorepo-stale-2026-07/
```

Luego crear `apps/compramelafoto/` vacío (o desde plantilla mínima) e importar **desde legacy**.

**Leyenda de acciones:**

| Acción | Significado |
|--------|-------------|
| **COPIAR** | Copiar tal cual; sin cambios de código en el paso de import |
| **ADAPTAR** | Copiar y modificar post-copia (aliases, `@repo/*`, rutas, ENV) |
| **FUSIONAR** | Combinar contenido legacy + patrones monorepo existentes |
| **DESCARTAR** | No importar al destino |

---

## 0. Tabla maestra — raíz del proyecto legacy

| Origen | Destino | Acción | Notas |
|--------|---------|--------|-------|
| `app/` | `apps/compramelafoto/app/` | **COPIAR** | ~893 archivos; ver §1 |
| `components/` | `apps/compramelafoto/components/` | **COPIAR** (+ sub-ADAPTAR) | ~602 archivos; ver §2 |
| `lib/` | `apps/compramelafoto/lib/` | **COPIAR** (+ sub-FUSIONAR/ADAPTAR) | ~802 archivos; ver §3 |
| `hooks/` | `apps/compramelafoto/hooks/` | **COPIAR** | 1 archivo |
| `contexts/` | `apps/compramelafoto/contexts/` | **COPIAR** | 2 archivos |
| `types/` | `apps/compramelafoto/types/` | **COPIAR** | 2 archivos |
| `emails/` | `apps/compramelafoto/emails/` | **COPIAR** | 6 archivos |
| `middleware.ts` | `apps/compramelafoto/middleware.ts` | **COPIAR** → **ADAPTAR** | Coordinar con `@repo/auth` post Fase 1 |
| `prisma/schema.prisma` | `packages/db/prisma/schema.prisma` | **FUSIONAR** | No copiar al app; ver ADR 0001 + §4 |
| `prisma/migrations/` | `packages/db/prisma/migrations/` | **FUSIONAR** | No replay 170 legacy; gap forward |
| `prisma/migrations_legacy/` | — | **DESCARTAR** | Backup histórico |
| `prisma/_migrations_backup/` | — | **DESCARTAR** | Backup histórico |
| `prisma/seed.ts` | `packages/db/prisma/seed.ts` o `apps/.../scripts/` | **ADAPTAR** | Imports → `@repo/db` |
| `prisma/seed-school-demo.ts` | `apps/compramelafoto/scripts/` | **ADAPTAR** | Mover a scripts |
| `prisma/seed-system-catalog-templates.ts` | `apps/compramelafoto/scripts/` | **ADAPTAR** | Mover a scripts |
| `prisma/scripts/` | `packages/db/prisma/scripts/` | **FUSIONAR** | SQL incidentales |
| `public/` | `apps/compramelafoto/public/` | **COPIAR** (excepto uploads) | ~539 archivos; ver §5 |
| `public/uploads/` | — | **DESCARTAR** | Datos dev; no versionar |
| `scripts/` | `apps/compramelafoto/scripts/` | **COPIAR** | ~109 archivos; ver §7 |
| `camera-ingest-worker/` | `apps/compramelafoto-workers/camera-ingest/` | **COPIAR** → **ADAPTAR** | Ver §8 |
| `camera-ftp-gateway/` | `apps/compramelafoto-workers/camera-ftp-gateway/` | **COPIAR** → **ADAPTAR** | Ver §8 |
| `video-worker/` | `apps/compramelafoto-workers/video/` | **COPIAR** → **ADAPTAR** | Ver §8 |
| `deploy/` | `apps/compramelafoto-workers/deploy/` | **COPIAR** | Ver §9 |
| `config/` | `apps/compramelafoto/config/` | **COPIAR** | Navegación / config app |
| `data/` | `apps/compramelafoto/data/` | **COPIAR** | Contenido estático (blog phases, etc.) |
| `assets/` | `apps/compramelafoto/assets/` | **COPIAR** | Assets no públicos |
| `styles/` | `apps/compramelafoto/styles/` | **COPIAR** | Si existe; estilos globales auxiliares |
| `docs/` (legacy interno) | `apps/compramelafoto/docs/legacy/` | **ADAPTAR** | Referencia; no mezclar con `docs/architecture/` suite |
| `_backup/` | — | **DESCARTAR** | |
| `test-results/` | — | **DESCARTAR** | |
| `visual-checks/` | — | **DESCARTAR** | |
| `node_modules/` | — | **DESCARTAR** | `pnpm install` en monorepo |
| `.next/` | — | **DESCARTAR** | |
| `.git/` | — | **DESCARTAR** | Historial queda en repo legacy |
| `.vercel/` | — | **DESCARTAR** | Re-vincular proyecto Vercel |
| `.env`, `.env.*` | — | **DESCARTAR** | Recrear desde `.env.example` + Vercel |
| `package-lock.json` | — | **DESCARTAR** | Monorepo usa `pnpm` |
| `*.md` raíz (~40 ops docs) | `apps/compramelafoto/docs/legacy/ops/` o **DESCARTAR** | **ADAPTAR** | Mayoría referencia histórica |
| `package.json` | `apps/compramelafoto/package.json` | **FUSIONAR** | Ver §10 |
| `tsconfig.json` | `apps/compramelafoto/tsconfig.json` | **FUSIONAR** | Ver §10 |
| `next.config.ts` | `apps/compramelafoto/next.config.ts` | **FUSIONAR** | Legacy más completo; ver §10 |
| `next-env.d.ts` | `apps/compramelafoto/next-env.d.ts` | **COPIAR** | Generado por Next |
| `eslint.config.mjs` | `apps/compramelafoto/eslint.config.mjs` | **COPIAR** | Casi idéntico al mono |
| `postcss.config.mjs` | `apps/compramelafoto/postcss.config.mjs` | **COPIAR** | Tailwind v4 |
| `vercel.json` | `apps/compramelafoto/vercel.json` | **COPIAR** → **ADAPTAR** | Crons + build command monorepo |
| `test-email.js` | `apps/compramelafoto/scripts/` | **ADAPTAR** | Utilidad puntual |
| Prettier | raíz monorepo | **FUSIONAR** | Legacy no tiene; usar `prettier` suite |
| Tailwind | vía `postcss` + `app/globals.css` | **COPIAR** | No hay `tailwind.config`; CSS-first v4 |

---

## 1. `app/` — App Router

**Destino base:** `apps/compramelafoto/app/`  
**Acción global:** **COPIAR** (árbol completo, ~893 archivos)

### 1.1 Archivos raíz de `app/`

| Origen | Destino | Acción |
|--------|---------|--------|
| `app/layout.tsx` | `apps/compramelafoto/app/layout.tsx` | **COPIAR** → **ADAPTAR** | Inyectar `ComprameLaFotoDesignProvider` (patrón mono stale) |
| `app/globals.css` | `apps/compramelafoto/app/globals.css` | **COPIAR** | Tokens CLF + `@import "tailwindcss"` |
| `app/favicon.ico` | `apps/compramelafoto/app/favicon.ico` | **COPIAR** | |
| `app/not-found.tsx` | `apps/compramelafoto/app/not-found.tsx` | **COPIAR** | |

### 1.2 Segmentos de rutas (`app/*`, excl. `api/`)

| Origen | Archivos ~ | Destino | Acción | Notas |
|--------|----------:|---------|--------|-------|
| `app/api/` | 565 | `apps/compramelafoto/app/api/` | **COPIAR** | Ver §1.3 |
| `app/admin/` | 72 | `.../app/admin/` | **COPIAR** | Panel super-admin |
| `app/fotografo/` | 28 | `.../app/fotografo/` | **COPIAR** | |
| `app/lab/` | 19 | `.../app/lab/` | **COPIAR** | |
| `app/dashboard/` | 16 | `.../app/dashboard/` | **COPIAR** | |
| `app/organizador/` | 13 | `.../app/organizador/` | **COPIAR** | Mono stale tenía rutas distintas → descartar mono |
| `app/design-system/` | 12 | `.../app/design-system/` | **COPIAR** | Showroom interno legacy |
| `app/cuantocobro/` | 12 | `.../app/cuantocobro/` | **COPIAR** | |
| `app/cliente/` | 10 | `.../app/cliente/` | **COPIAR** | |
| `app/[handler]/` | 9 | `.../app/[handler]/` | **COPIAR** | Rutas dinámicas cortas |
| `app/l/` | 8 | `.../app/l/` | **COPIAR** | Short links |
| `app/album/` | 8 | `.../app/album/` | **COPIAR** | |
| `app/g/` | 7 | `.../app/g/` | **COPIAR** | |
| `app/pago/` | 6 | `.../app/pago/` | **COPIAR** | |
| `app/a/` | 6 | `.../app/a/` | **COPIAR** | Álbum público |
| `app/imprimir/` | 5 | `.../app/imprimir/` | **COPIAR** | |
| `app/e/` | 5 | `.../app/e/` | **COPIAR** | Event short |
| `app/directorio/` | 5 | `.../app/directorio/` | **COPIAR** | |
| `app/blog/` | 5 | `.../app/blog/` | **COPIAR** | |
| Resto segmentos (≤4 archivos) | 1–4 | mismo path relativo | **COPIAR** | `ayuda`, `charlas`, `escolar`, `login`, `registro`, etc. |

### 1.3 `app/api/` — segmentos (565 archivos)

**Destino:** `apps/compramelafoto/app/api/<segmento>/`  
**Acción:** **COPIAR** cada árbol completo

| Origen (`app/api/…`) | Acción | Notas |
|----------------------|--------|-------|
| `admin/`, `albums/`, `orders/`, `photos/`, `payments/`, `mercadopago/` | **COPIAR** | Core revenue |
| `auth/` | **COPIAR** → **ADAPTAR** | Fase 1: bridge `@repo/auth` |
| `cron/` | **COPIAR** → **ADAPTAR** | 15 jobs; `CRON_SECRET` |
| `dashboard/` | **COPIAR** | No fusionar WIP mono `design-projects/*` |
| `school-organizer/`, `school-leads/` | **COPIAR** | Fase 4 escolar |
| `camera-connection` vía `lib/` + crons | **COPIAR** | Workers aparte |
| Resto 54 segmentos (`a`, `album-extensions`, `album-pack-*`, `analytics`, `banner`, `blog`, `camofduty`, `charlafotoescolar`, `charlasfpr`, `cliente`, `config`, `contact`, `cuantocobro`, `cuenta`, `debug-env`, `descargas`, `downloads`, `events`, `fotografo`, `fotolibros-test`, `geocode`, `health`, `interested`, `internal`, `invitations`, `lab`, `labs`, `organizer`, `precompra`, `print-*`, `prints`, `privacy-requests`, `public`, `recommend-lab`, `referrals`, `removal-requests`, `support`, `system-settings`, `template-v2`, `terms`, `test`, `tutorials`, `unsubscribe`, `uploads`, `upsells`, `users`, `zip-jobs`) | **COPIAR** | |

---

## 2. `components/` (~602 archivos)

**Destino:** `apps/compramelafoto/components/`  
**Acción global:** **COPIAR**, con excepciones.

| Origen | Archivos ~ | Acción | Notas |
|--------|----------:|--------|-------|
| `components/simulator/` | 82 | **COPIAR** | |
| `components/cuantocobro/` | 68 | **COPIAR** | |
| `components/dashboard/` | 66 | **COPIAR** | |
| `components/fotografo/` | 43 | **COPIAR** | |
| `components/home-preview/` | 34 | **COPIAR** | |
| `components/organizer/` | 28 | **COPIAR** | |
| `components/admin/` | 28 | **COPIAR** | |
| `components/land/` | 26 | **COPIAR** | |
| `components/template-v2/` | 24 | **COPIAR** | |
| `components/blog/` | 22 | **COPIAR** | |
| `components/ui/` | 17 | **ADAPTAR** | Migrar a `@repo/design-system` |
| `components/design-system/` | 13 | **ADAPTAR** | Solapamiento DS |
| `components/layout/` | 6 | **FUSIONAR** | Rescatar provider/menu del archive mono |
| Resto subcarpetas + 3 archivos raíz | ≤17 c/u | **COPIAR** | Ver inventario §2 en `02-legacy-inventory.md` |

---

## 3. `lib/` (~802 archivos)

**Destino:** `apps/compramelafoto/lib/`

| Origen | Acción | Notas |
|--------|--------|-------|
| `lib/prisma.ts` | **FUSIONAR** | Reexport `@repo/db` |
| `lib/auth.ts` | **FUSIONAR** | Bridge `auth-token` + `@repo/auth` |
| `lib/design-system/` | **ADAPTAR** | vs `@repo/design-system` |
| `lib/cuantocobro/` (147) | **COPIAR** | |
| `lib/simulator/` (64) | **COPIAR** | |
| `lib/albums/` (51) | **COPIAR** | |
| `lib/album-packs/` (35) | **COPIAR** | Legacy gana vs mono stale |
| `lib/school-roster/` | **COPIAR** → **ADAPTAR** | `Student` → `SchoolStudent` post-ADR |
| Resto 165 entradas top-level | **COPIAR** | Incluye ~100 archivos `.ts` sueltos |

**Post-import:** codemod `@prisma/client` → `@repo/db`.

---

## 4. `prisma/`

| Origen | Destino | Acción |
|--------|---------|--------|
| `prisma/schema.prisma` | `packages/db/prisma/schema.prisma` | **FUSIONAR** |
| `prisma/migrations/*` (170) | `packages/db/prisma/migrations/` | **FUSIONAR** |
| `prisma/migrations_legacy/`, `_migrations_backup/` | — | **DESCARTAR** |
| `prisma/seed*.ts` | scripts o `packages/db` | **ADAPTAR** |
| `prisma/scripts/*.sql` | `packages/db/prisma/scripts/` | **FUSIONAR** |

**No** dejar `prisma/schema.prisma` en `apps/compramelafoto/` tras migración completa.

---

## 5. `public/`

| Origen | Acción |
|--------|--------|
| `public/**` (excepto uploads) | **COPIAR** → `apps/compramelafoto/public/` |
| `public/uploads/` (~318 archivos) | **DESCARTAR** |

Subcarpetas: `Ico/`, `camofduty/`, `catalog-templates/`, `cuantocobro/`, `dnx/`, `home-preview/`, `images/`, `leaflet/`, `photos/`, `sounds/`, `texturas/`.

---

## 6. `hooks/`, `contexts/`, `types/`, `emails/`, `middleware.ts`

| Origen | Destino | Acción |
|--------|---------|--------|
| `middleware.ts` | `apps/compramelafoto/middleware.ts` | **COPIAR** → **ADAPTAR** |
| `hooks/useSupportTicketDeepLink.ts` | `apps/compramelafoto/hooks/...` | **COPIAR** |
| `contexts/GateVisibilityContext.tsx` | `apps/compramelafoto/contexts/...` | **COPIAR** |
| `contexts/UploadProgressContext.tsx` | `apps/compramelafoto/contexts/...` | **COPIAR** |
| `types/archiver.d.ts` | `apps/compramelafoto/types/...` | **COPIAR** |
| `types/piexifjs.d.ts` | `apps/compramelafoto/types/...` | **COPIAR** |
| `emails/send.ts` | `apps/compramelafoto/emails/...` | **COPIAR** |
| `emails/signature.ts` | `apps/compramelafoto/emails/...` | **COPIAR** |
| `emails/types.ts` | `apps/compramelafoto/emails/...` | **COPIAR** |
| `emails/templates/album-interest.ts` | `apps/compramelafoto/emails/templates/...` | **COPIAR** |
| `emails/templates/auth.ts` | `apps/compramelafoto/emails/templates/...` | **COPIAR** |
| `emails/templates/support-reply.ts` | `apps/compramelafoto/emails/templates/...` | **COPIAR** |

---

## 7. `scripts/` (~109 archivos)

**Destino:** `apps/compramelafoto/scripts/` — **COPIAR** árbol completo.

| Excepción | Acción |
|-----------|--------|
| `scripts/output/` | **DESCARTAR** |
| `scripts/e2e-school-setup.ts` (solo mono) | **DESCARTAR** |

Post-copia: **ADAPTAR** imports Prisma en todos los `.ts`.

---

## 8. Workers

**Destino:** `apps/compramelafoto-workers/` (nuevo workspace)

### `camera-ingest-worker/` → `camera-ingest/`

| Origen | Acción |
|--------|--------|
| `src/*.ts` (6 archivos) | **COPIAR**; `prisma.ts` **ADAPTAR** |
| `Dockerfile`, `package.json`, `tsconfig.json`, `README.md` | **COPIAR** / **ADAPTAR** |
| `scripts/postinstall-prisma.mjs` | **DESCARTAR** |

### `camera-ftp-gateway/` → `camera-ftp-gateway/`

| Origen | Acción |
|--------|--------|
| `src/*.ts` (11 archivos) | **COPIAR**; `prisma.ts` **ADAPTAR** |
| `Dockerfile`, `docker-compose.yml`, `package.json`, tests | **COPIAR** / **ADAPTAR** |
| `scripts/postinstall-prisma.mjs` | **DESCARTAR** |

### `video-worker/` → `video/`

| Origen | Acción |
|--------|--------|
| `src/*.ts` (8 archivos) | **COPIAR**; `prisma.ts` **ADAPTAR** |
| `scripts/postinstall-prisma.mjs` | **DESCARTAR** |

---

## 9. `deploy/`

| Origen | Destino | Acción |
|--------|---------|--------|
| `deploy/camera-connection/.env.example` | `apps/compramelafoto-workers/deploy/camera-connection/` | **COPIAR** |
| `deploy/camera-connection/docker-compose.yml` | idem | **COPIAR** |

---

## 10. Configuración

| Origen | Destino | Acción |
|--------|---------|--------|
| `package.json` | `apps/compramelafoto/package.json` | **FUSIONAR** |
| `tsconfig.json` | `apps/compramelafoto/tsconfig.json` | **FUSIONAR** |
| `next.config.ts` | `apps/compramelafoto/next.config.ts` | **FUSIONAR** (legacy gana en trace/CSP/redirects) |
| `eslint.config.mjs` | `apps/compramelafoto/eslint.config.mjs` | **COPIAR** |
| `postcss.config.mjs` | `apps/compramelafoto/postcss.config.mjs` | **COPIAR** |
| `vercel.json` | `apps/compramelafoto/vercel.json` | **COPIAR** → **ADAPTAR** |
| Prettier | raíz suite | **FUSIONAR** (legacy no tiene) |
| Tailwind v4 | `globals.css` + postcss | **COPIAR** (sin `tailwind.config`) |

**Fusión `package.json`:** deps legacy completas + `@repo/*` del mono; quitar `postinstall`/`package-lock`; prisma scripts → `@repo/db`; `dev --port 3002`.

---

## 11. Mono stale — DESCARTAR (89 paths)

No importar; quedan en `apps/_archive/compramelafoto-monorepo-stale-2026-07/`.

| Origen (mono stale) | Destino | Acción |
|---------------------|---------|--------|
| `.env.e2e`, `.env.staging.local`, `.turbo/*`, `.vercel/project.json` | — | **DESCARTAR** |
| `app/actions/workspace.ts` | — | **DESCARTAR** |
| `app/api/dashboard/albums/[albumId]/**` (35 routes WIP) | — | **DESCARTAR** |
| `app/apple-icon.png`, `app/icon.png` | — | **DESCARTAR** |
| `app/cuenta/cambiar-contraseña/page.tsx` | — | **DESCARTAR** |
| `app/dashboard/albums/[albumId]/**` (mono) | — | **DESCARTAR** |
| `app/design-system-test/page.tsx` | — | **DESCARTAR** |
| `app/fotografo/diseno/escolar/**` | — | **DESCARTAR** |
| `app/organizador/comunidad|dashboard|events|soporte/**` | — | **DESCARTAR** |
| `components/directorio/Directory*.tsx`, `directoryCardClasses.ts` | — | **DESCARTAR** |
| `components/layout/ComprameLaFotoFullscreenMenu.tsx` | archive → layout | **FUSIONAR** |
| `components/providers/ComprameLaFotoDesignProvider.tsx` | archive → layout | **FUSIONAR** |
| `components/school-design/**` | — | **DESCARTAR** |
| `components/workspace/SuiteWorkspaceSwitcher.tsx` | — | **DESCARTAR** |
| `e2e/**`, `playwright.config.ts` | — | **DESCARTAR** |
| `lib/auth-bridge.ts` | `lib/auth.ts` | **FUSIONAR** |
| `lib/school-design/**` (17 archivos) | — | **DESCARTAR** |
| `lib/workspace-options.ts` | — | **DESCARTAR** |
| `public/og-image.png`, `public/site.webmanifest` | — | **DESCARTAR** |
| `scripts/e2e-school-setup.ts` | — | **DESCARTAR** |

Regenerar diff mono-only:

```bash
comm -23 \
  <(find apps/compramelafoto -type f ! -path '*/node_modules/*' | sed 's|.*/compramelafoto/||' | sort) \
  <(find /Users/danielcuart/Desktop/compramelafoto -type f ! -path '*/node_modules/*' | sed 's|.*/compramelafoto/||' | sort)
```

---

## 12. Conflictos esperados

### 12.1 Turbo / monorepo

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| T1 | `turbo build` → `dependsOn: ["^build"]`; `@repo/db` debe generar client primero | Alta | Task `db:generate` en `packages/db` |
| T2 | `package-lock.json` legacy incompatible con pnpm | Alta | No importar lock; `pnpm install` |
| T3 | Workers fuera del grafo Turbo inicial | Media | Registrar en `pnpm-workspace.yaml` |
| T4 | Cache Turbo invalidado por `.env*` en inputs | Baja | Alinear `.env.example` |
| T5 | Puerto dev: FotoRank 3000, CLF 3002 | Baja | Mantener `--port 3002` |

### 12.2 `packages/*` / `@repo/*`

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| P1 | Miles de imports `@/lib/prisma` → `new PrismaClient()` legacy | Crítica | `lib/prisma.ts` reexport `@repo/db` |
| P2 | Imports directos `@prisma/client` en app + workers | Alta | Codemod → `@repo/db` |
| P3 | Cookie `auth-token` vs `dnx_session` (`@repo/auth`) | Crítica | Bridge Fase 1 |
| P4 | `@repo/auth-guards` no usado en legacy | Alta | Introducir progresivamente |
| P5 | `components/ui` local vs `@repo/design-system` | Media | Migración gradual + provider |
| P6 | `packages/ui` vs design-system | Baja | CLF usa `@repo/design-system` |
| P7 | Schema 186 legacy vs 162 monorepo | Crítica | ADR 0001 antes de import con datos |
| P8 | `Student` → `SchoolStudent` (ADR D1) | Alta | Refactor Fase 4 escolar |
| P9 | `ExportJobStatus`: `COMPLETED` → `SUCCEEDED` | Media | Migración SQL + codemod |
| P10 | `@repo/typescript-config` / eslint-config no en legacy | Baja | Opcional al fusionar configs |

### 12.3 Rutas Next.js

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| R1 | `app/design-system-test/` solo mono | Baja | Descartar o showroom suite |
| R2 | `organizador/dashboard` mono vs legacy `organizador/*` | Media | Legacy gana |
| R3 | `fotografo/diseno/escolar` WIP mono | Media | Descartar WIP |
| R4 | Short links `/a`, `/l`, `/g`, `/e` | Alta | COPIAR tal cual |
| R5 | 15 crons `vercel.json` ↔ `app/api/cron/*` | Alta | Verificar 1:1 post-copia |
| R6 | `photoViewTraceExcludes` en `next.config` | Media | Mantener config legacy |

### 12.4 Aliases e imports

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| A1 | Alias `@/*` → `./*` idéntico | Ninguna | Sin cambio |
| A2 | Workers: prisma local + paths relativos | Alta | Workspace protocol + `@repo/db` |
| A4 | `serverExternalPackages: ["@prisma/client", "prisma", "sharp"]` | Media | Ajustar post-`@repo/db` |
| A5 | Deps solo legacy: `@dnd-kit/*`, más scripts npm | Baja | Incluir en `package.json` fusionado |

### 12.5 Prisma / datos

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| D1 | 170 migraciones legacy vs 20 monorepo | Crítica | `prisma-migration-plan.md` |
| D2 | `prisma migrate deploy` en `vercel-build` legacy | Alta | Sacar migrate a CI |
| D3 | `postinstall: prisma generate` duplica `@repo/db` | Alta | Eliminar del app package |
| D4 | Seeds referencian schema local | Media | ADAPTAR imports |
| D5 | Workers `postinstall-prisma.mjs` | Media | DESCARTAR |

### 12.6 Infra / deploy

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| I1 | Vercel ligado a repo standalone | Alta | Root `apps/compramelafoto` en monorepo |
| I2 | Workers Docker fuera de Vercel | Media | Mantener `deploy/` + Dockerfiles |
| I3 | `public/uploads` en git legacy | Media | `.gitignore` monorepo |
| I4 | ~80+ variables ENV legacy | Alta | Matriz ENV; `.env.example` |
| I5 | `sharp` serverless — `serverExternalPackages` | Alta | Mantener de legacy |

### 12.7 Funcional / dominio

| ID | Conflicto | Severidad | Mitigación |
|----|-----------|-----------|------------|
| F1 | Album packs API mono vs legacy | Media | Legacy gana (ADR D6) |
| F2 | School design editor WIP solo mono | Baja | DESCARTAR |
| F3 | Multi-workspace suite (`workspace.ts`) | Baja | DESCARTAR en CLF v1 |
| F4 | MP, R2, Rekognition, Resend — mismas deps | Baja | COPIAR env + lib |

---

## 13. Orden de ejecución

1. Archivar mono stale
2. Merge Prisma `packages/db` (ADR 0001)
3. Esqueleto configs + `lib/prisma.ts` + `lib/auth.ts`
4. Import por fases (`04-domain-import-plan.md`)
5. Codemods + workers en workspace

---

## Apéndice — Manifest TSV automático

```bash
LEGACY="/Users/danielcuart/Desktop/compramelafoto"
OUT="docs/architecture/migration/05-import-manifest.tsv"

find "$LEGACY" -type f \
  ! -path '*/node_modules/*' ! -path '*/.next/*' ! -path '*/.git/*' \
  ! -path '*/public/uploads/*' ! -path '*/_backup/*' \
  ! -name '.DS_Store' ! -name '._*' ! -name 'package-lock.json' \
| sed "s|$LEGACY/||" | sort | while IFS= read -r rel; do
    action="COPIAR"; dest="apps/compramelafoto/$rel"
    case "$rel" in
      prisma/schema.prisma) action="FUSIONAR"; dest="packages/db/prisma/schema.prisma" ;;
      prisma/migrations/*) action="FUSIONAR"; dest="packages/db/prisma/migrations/..." ;;
      prisma/migrations_legacy/*|prisma/_migrations_backup/*) action="DESCARTAR"; dest="—" ;;
      lib/prisma.ts|lib/auth.ts) action="FUSIONAR" ;;
      components/ui/*|components/design-system/*) action="ADAPTAR" ;;
      camera-ingest-worker/*) action="ADAPTAR"; dest="apps/compramelafoto-workers/camera-ingest/${rel#camera-ingest-worker/}" ;;
      camera-ftp-gateway/*) action="ADAPTAR"; dest="apps/compramelafoto-workers/camera-ftp-gateway/${rel#camera-ftp-gateway/}" ;;
      video-worker/*) action="ADAPTAR"; dest="apps/compramelafoto-workers/video/${rel#video-worker/}" ;;
    esac
    printf '%s\t%s\t%s\n' "$rel" "$dest" "$action"
  done > "$OUT"
```

---

## Checklist pre-import

- [ ] Archivar `apps/compramelafoto` stale
- [ ] ADR 0001 en `packages/db`
- [ ] `pnpm-workspace.yaml` + workers
- [ ] `.gitignore` uploads / env
- [ ] Vercel root + build monorepo
- [ ] Autorización explícita para copia física

---

*Generado sin modificar legacy ni copiar archivos.*
