# 01 — Auditoría CLF Legacy vs CLF Monorepo

**Etapa:** ETAPA 01 — IMPLEMENTACIÓN 01  
**Fecha:** 2026-07-29  
**Alcance:** diagnóstico verificable (sin implementación funcional, sin commit/push/deploy)  
**Docs previos consolidados:** `docs/architecture/migration/` (01–30), ADR-0001

---

## 1. Identificación de sistemas

### LEGACY

| Campo | Valor verificado |
|-------|------------------|
| **Ruta local** | `/Users/danielcuart/Desktop/compramelafoto` |
| **Repo** | `git@github.com:compramelafoto/compramelafoto.git` |
| **Branch** | `main` |
| **HEAD** | `e86e65ac153e5b8e0e0947f0c17b60b1f5583eef` (2026-07-19) — *fix(admin): mostrar total real de fotógrafos sin tope de 500* |
| **Working tree** | Dirty menor (`lib/cuantocobro/*`, `next-env.d.ts`) |
| **Framework** | Next.js **16.1.1** + React 19.2.3 (App Router) |
| **Node** | (engines no fijados en package; entorno auditor: Node 24.12.0) |
| **Package manager** | **npm** (`package-lock.json`) |
| **ORM** | Prisma **6.19.1** — schema local `prisma/schema.prisma` |
| **DB** | PostgreSQL (Neon en prod; pooler + `DIRECT_URL`) |
| **Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) |
| **Auth** | Cookie `auth-token` (payload base64) + bcrypt; Google OAuth |
| **Pagos** | Mercado Pago Checkout Pro Preferences + `marketplace_fee` + OAuth cobrador |
| **Email** | Resend |
| **Workers** | `camera-ftp-gateway/`, `camera-ingest-worker/`, `video-worker/` (raíz legacy) |
| **Páginas** | **264** (`page.tsx`) |
| **API routes** | **564** (`route.ts`) |
| **Modelos Prisma** | **186** (+ ~126 enums) |
| **Migraciones** | **~172** carpetas |

### MONOREPO

| Campo | Valor verificado |
|-------|------------------|
| **Ruta local** | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| **Repo** | `https://github.com/compramelafoto/dnx-suite.git` |
| **Branch** | `migration-legacy-clf-to-monorepo` (tracks `origin/…`) |
| **HEAD** | `f6bd41c02bb87d67bb6dd49ea00ad6917cfbd395` (2026-07-29) |
| **Working tree** | **~144** paths dirty (auth suite + CLF + Clickaton/FotoRank/etc.) |
| **Workspace** | pnpm + turbo (`packageManager: pnpm@9.0.0`, `engines.node: >=18`) |
| **App CLF** | `apps/compramelafoto` (dev puerto **3002**) |
| **Workers** | `apps/compramelafoto-workers/{camera-ftp-gateway,camera-ingest,video}` |
| **Packages usados por CLF** | `@repo/db`, `@repo/auth`, `@repo/auth-guards`, `@repo/auth-ui`, `@repo/payments`, `@repo/design-system`, `@repo/geo`, `@repo/cuanto-cobro-core` |
| **Apps que comparten `@repo/db`** | compramelafoto, fotoffice, fotorank, clickaton, infospot |
| **Framework** | Next.js **16.2.1** + React 19.2.4 |
| **ORM** | Prisma vía `@repo/db` (`packages/db/prisma/schema.prisma`) |
| **DB** | PostgreSQL unificado (superset schema suite) |
| **Storage** | Cloudflare R2 (mismo patrón) |
| **Auth** | Dual: `dnx_session` (`@repo/auth`) + fallback/emisión `auth-token` |
| **Pagos** | Mismo código Checkout Pro Legacy (+ dual-read FI opcional) |
| **Email** | Resend |
| **Páginas** | **230** |
| **API routes** | **521** |
| **Modelos Prisma** | **365** (+ ~322 enums) |
| **Migraciones mono** | **~90** carpetas |

---

## 2. Decisión arquitectónica (contexto)

1. Terminar migración Legacy → Monorepo.  
2. Paridad funcional 1:1.  
3. Validar staging → producción.  
4. Congelar Legacy como rollback.  
5. **Después** integrar DNX Payments 1:N.

**DNX Payments 1:N no es bloqueante de paridad Legacy.**

---

## 3. Estado de importación previa

Documentación en `docs/architecture/migration/`:

| Doc | Hallazgo |
|-----|----------|
| `02-legacy-inventory.md` | Inventario cuantitativo Legacy |
| `03-prisma-diff.md` | Diff schema (histórico 2026-07-04) |
| `05-import-map.md` | Mapa: `app/lab/` marcado **COPIAR** |
| `23`–`29` | Oleadas de import de código |
| `30-code-import-final-audit-report.md` | Cierre ~96 % (2026-07-05); typecheck/build OK |

**Hallazgo de esta auditoría (2026-07-29):** el informe 30 sobreestimó paridad de paneles. El código actual documenta explícitamente:

```ts
// apps/compramelafoto/lib/auth/post-login-destination.ts
// LAB aún no migrado en monorepo → destino seguro `/`
```

Deltas medidos Legacy − Mono: **−34 páginas**, **−43 APIs**.

---

## 4. Commits Legacy posteriores al import

Desde 2026-07-05 en Legacy `main` (3 commits):

| Commit | Tema | Impacto paridad |
|--------|------|-----------------|
| `1dc8084a` | CLF-ORGANIZER-AS-COLLECTOR-100 | Pagos — verificar sync (archivos MP core reportados idénticos) |
| `618cca5b` | CTA OAuth MP (Button asChild) | UI menor |
| `e86e65ac` | Admin fotógrafos sin tope 500 | Admin métricas |

---

## 5. Resumen ejecutivo de paridad

| Área | Veredicto |
|------|-----------|
| Core álbum / foto / checkout MP / webhook | **Alta paridad** (código casi idéntico) |
| Panel Lab (`app/lab/*` + APIs lab) | **NO migrado** — P0 |
| Template-v2 APIs fotógrafo | **Faltantes** — P1 |
| APIs públicas escolares/comunidad | **Parcial** — P1 |
| Auth | **Implementado diferente** (bridge DNX) — en progreso en working tree |
| Schema Prisma | **Superset lógico**; cutover SQL **no safe** sin rename `Student`→`SchoolStudent` |
| DNX Payments 1:N | **POST_MIGRATION** (no bloquea paridad) |
| Tests dominio álbum/packs/pricing | **Regresión de cobertura** vs Legacy |

---

## 6. Documentos de esta carpeta

| # | Archivo |
|---|---------|
| 02 | `02-feature-parity-matrix.md` |
| 03 | `03-database-parity.md` |
| 04 | `04-routes-parity.md` |
| 05 | `05-env-infrastructure.md` |
| 06 | `06-payment-current-state.md` |
| 07 | `07-cutover-blockers.md` |
| 08 | `08-migration-execution-plan.md` |
| 09 | `09-legal-human-review.md` |

---

## 7. Safety (esta etapa)

- No commit / no push / no deploy  
- No migraciones destructivas  
- No cambios de variables de producción  
- No eliminación de código Legacy  
- Solo documentación (y consolidación) en `docs/clf-migration/`
