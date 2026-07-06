# 30 — Reporte Bloque F: Auditoría final y limpieza migración CLF

**Fecha:** 2026-07-05  
**Validaciones ejecutadas:** 2026-07-05 ~21:09–21:28 (UTC-3)  
**Bloque:** F — Auditoría final  
**Alcance:** `apps/compramelafoto`, `apps/compramelafoto-workers`, configuración monorepo  
**Bloque anterior:** [`29`](./29-code-import-block-e-infra-report.md)

---

## Resumen ejecutivo

Bloque F **cerrado**. Escaneo de paths legacy, Prisma local, artefactos y cinco validaciones `pnpm` ejecutadas en esta sesión. La migración legacy → monorepo es **funcionalmente completa** para app Next y workers runtime.

| Validación | Resultado | Duración aprox. |
|------------|-----------|-----------------|
| `pnpm --filter compramelafoto typecheck` | ✅ exit 0 | ~3 min |
| `pnpm --filter compramelafoto build` | ✅ exit 0 | ~15 min |
| `pnpm --filter compramelafoto lint` | ✅ exit 0 (0 errors, 1684 warnings) | ~2 min |
| `pnpm --filter compramelafoto-workers typecheck` | ✅ exit 0 | ~1.5 min |
| `pnpm --filter compramelafoto-workers build` | ✅ exit 0 (alias typecheck) | ~1 min |

**Migración estimada:** **~96 %** funcional (app + workers runtime); **~90 %** incluyendo ops/deploy/docker.

**Listo para commit:** sí.

**Sin commit** en esta sesión.

---

## 1. Escaneo de paths legacy

Comando: `rg -l 'Desktop/compramelafoto|/Users/danielcuart' apps/compramelafoto apps/compramelafoto-workers`

| Resultado | Archivos |
|-----------|----------|
| Coincidencias | **1** |
| Detalle | `apps/compramelafoto/README.md` — referencia documentada al repo fuente legacy |

**Workers:** 0 paths absolutos legacy.

**Imports rotos:** 0 (confirmado por typecheck).

**`prisma/` local en app:** 0 (sin `postinstall-prisma`, sin schema local).

**Bridge Prisma:** `apps/compramelafoto/lib/prisma.ts` → `export { prisma } from "@repo/db"` + re-export tipos desde `@prisma/client`.

---

## 2. Prisma local restante (scripts / Dockerfiles)

### Runtime app (`app/`, `lib/`, `components/`)

| Patrón | Cantidad | Severidad |
|--------|----------|-----------|
| `import … from "@prisma/client"` (excl. `lib/prisma.ts`) | **191 archivos** | Baja — compila; mismo cliente que `@repo/db` |
| `new PrismaClient()` | **0** | ✅ |

### Scripts ops (`apps/compramelafoto/scripts/`)

| Patrón | Cantidad | Severidad |
|--------|----------|-----------|
| `import … from "@prisma/client"` | **50 archivos** | Baja — excluidos de `tsc` / eslint |
| `new PrismaClient()` | **42 archivos** | Baja — uso standalone ops |

**Estado:** scripts copiados del legacy; no bloquean build ni deploy Vercel. Pendiente adaptar a `@repo/db` en commit opcional post-staging.

### Workers (`apps/compramelafoto-workers/`)

| Patrón | Cantidad | Severidad |
|--------|----------|-----------|
| `@prisma/client` en código | **0** | ✅ — `src/prisma.ts` usa `@repo/db` |
| `@prisma/client` en docs | **1** (`video/README.md`, mención textual) | Ninguna |
| `new PrismaClient()` | **0** | ✅ |

### Dockerfiles (layout legacy standalone)

| Archivo | Contenido legacy | Estado |
|---------|------------------|--------|
| `camera-ingest/Dockerfile` | `COPY prisma`, `npm ci`, `npx prisma generate` | ⚠️ No válido en monorepo — comentario de advertencia añadido |
| `camera-ftp-gateway/Dockerfile` | Idem | ⚠️ Idem |

**Deploy recomendado en monorepo:** `pnpm --filter compramelafoto-camera-ingest-worker start` (ver `deploy/README.md`). Reescritura Docker pendiente antes de prod container.

---

## 3. `node_modules` / `.next` no versionados

Escaneo local en `apps/compramelafoto`:

| Artefacto | Presente en disco | Versionado en git |
|-----------|-------------------|-------------------|
| `node_modules/` | Sí (post-`pnpm install`) | No — `apps/compramelafoto/.gitignore` + raíz |
| `.next/` | Sí (post-build) | No — gitignored |
| `.env` / `.env.local` | No encontrados | — |
| `public/uploads/` | No en árbol versionado | — |
| Artefactos macOS `._*` en workers | Eliminados (Block F) | — |

`git check-ignore` confirma que `node_modules` y `.next` están ignorados correctamente.

---

## 4. Problemas corregidos (Bloque F)

| Archivo | Corrección |
|---------|------------|
| `lib/school-organizer-management-access.ts` | `Role` desde `@/lib/prisma` |
| `lib/email-marketing/audience.ts` | `Role` desde `@/lib/prisma` |
| `camera-ingest/Dockerfile`, `camera-ftp-gateway/Dockerfile` | Comentarios advertencia layout legacy |
| `deploy/README.md` | Instrucciones deploy monorepo vs Docker legacy |
| `apps/compramelafoto/README.md` | Tabla estado Blocks A–F |
| `apps/compramelafoto-workers/**/._*` | Limpieza artefactos macOS |

---

## 5. Resultados de validación (sesión actual)

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"

pnpm --filter compramelafoto typecheck          # exit 0
pnpm --filter compramelafoto build              # exit 0
pnpm --filter compramelafoto lint               # exit 0 — 0 errors, 1684 warnings
pnpm --filter compramelafoto-workers typecheck  # exit 0 (ingest + ftp-gateway + video)
pnpm --filter compramelafoto-workers build      # exit 0 (alias typecheck)
```

### Build — advertencias no bloqueantes

- Next.js 16: convención `middleware` deprecada (migrar a `proxy` en el futuro).
- Turbopack: `export *` desde `@prisma/client` (CJS) — warning de bundling.
- `next.config.ts`: NFT trace amplio vía `watermark-render.ts` — revisar en optimización posterior.

### Lint

- **0 errors**, **1684 warnings** (deuda legacy: `no-explicit-any`, `no-use-before-define`, `no-unused-vars`, etc.).
- 12 warnings auto-fixables con `--fix` (no aplicado — fuera de alcance Bloque F).

---

## 6. Dependencias revisadas

| Paquete | App | Workers | Notas |
|---------|-----|---------|-------|
| `@repo/db` | ✅ | ✅ | Fuente de verdad Prisma |
| `@prisma/client` | ✅ (bridge) | ❌ en código | Re-export intencional en `lib/prisma.ts` |
| `prisma` CLI | ❌ en app | ❌ | Solo en `packages/db` |
| Duplicados críticos | Ninguno detectado | | |

---

## 7. Riesgos pendientes

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Dockerfiles workers legacy | Deploy container roto | Reescribir para pnpm monorepo |
| 191 imports `@prisma/client` en runtime | Mantenimiento / drift enums | Codemod → `@/lib/prisma` post-staging |
| 42 scripts con `new PrismaClient()` | Ops manual puede fallar | Documentar `DATABASE_URL` + migrar a `@repo/db` |
| ~1684 lint warnings | Ruido CI | Reducir gradualmente |
| Sin smoke E2E staging | Regresiones funcionales | Checklist §8 |
| Build warnings Turbopack/Prisma | Posible regresión bundling | Monitorear en staging |
| `turbo.json` sin workers | CI parcial | Añadir workers si se despliegan en CI |

---

## 8. Checklist para staging

### Infra / ENV

- [ ] `DATABASE_URL` / `DIRECT_URL` en Vercel (misma DB que `@repo/db`)
- [ ] `CRON_SECRET` configurado; probar 2–3 crons (`process-email-queue`, `process-zip-jobs`, `reconcile-mp-pending-orders`)
- [ ] `R2_*`, `MP_*`, `RESEND_API_KEY`, `AUTH_SECRET`, `APP_URL`
- [ ] Workers en VM: `pnpm --filter compramelafoto-camera-ingest-worker start` (no Docker legacy)

### Funcional mínimo

- [ ] `/api/health/db-schema` responde OK
- [ ] Login fotógrafo / admin
- [ ] Álbum público + checkout sandbox MP
- [ ] Blog público + admin post
- [ ] CuántoCobro wizard carga
- [ ] Upload foto / camera ingest (si workers activos)

### Monorepo

- [ ] `pnpm install` en CI desde raíz
- [ ] `pnpm --filter compramelafoto build` en pipeline
- [ ] Sin mezclar deploy de `apps/fotoffice` / `apps/fotorank` en release CLF

---

## 9. Porcentaje estimado de migración final

| Dominio legacy | Estado | % |
|----------------|--------|---|
| Auth / shell / middleware | Migrado | 100 % |
| Álbumes / fotos / galería | Migrado | 100 % |
| Checkout / MP / cliente | Migrado | 100 % |
| Dashboard / fotógrafo / escolar | Migrado | 100 % |
| Blog / marketing / CuántoCobro | Migrado | 100 % |
| Crons / admin API / health | Migrado | 100 % |
| Workers (código runtime) | Migrado + `@repo/db` | 95 % |
| Workers (Docker deploy) | Pendiente rewrite | 20 % |
| Scripts ops | Copiados; Prisma standalone | 70 % |
| Codemod `@/lib/prisma` (191 archivos runtime) | Pendiente | 0 % |

**Total funcional (app Next + workers runtime):** **~96 %**  
**Total incl. ops/deploy/docker:** **~90 %**

### Métricas

| Métrica | Valor |
|---------|-------|
| Archivos fuente TS/JS/CSS (app + workers, sin node_modules/.next) | 2223 |
| API routes (`route.ts`) | 483 |
| Cron routes | 24 |
| Worker packages | 3 (ingest, ftp-gateway, video) |

---

## 10. Diff Bloque F (pendiente de commit)

| Archivo | Cambio |
|---------|--------|
| `lib/school-organizer-management-access.ts` | import `@/lib/prisma` |
| `lib/email-marketing/audience.ts` | import `@/lib/prisma` |
| `workers/*/Dockerfile` | advertencias monorepo |
| `workers/deploy/README.md` | nuevo |
| `apps/compramelafoto/README.md` | estado migración |
| `docs/.../30-code-import-final-audit-report.md` | este reporte |

### Commit sugerido

```
docs(clf): final migration audit report
```

Commits opcionales posteriores: codemod Prisma (191 archivos), Dockerfiles monorepo, migración scripts ops.
