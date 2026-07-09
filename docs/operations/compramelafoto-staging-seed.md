# ComprameLaFoto — Seed mínimo de staging

**Fecha:** 2026-07-09  
**Monorepo:** `dnx-suite` → `apps/compramelafoto/scripts/staging/`  
**Base objetivo:** Neon staging de `compramelafoto-dnxsuite` (host `ep-round-fog-a4xgibtv`)  
**Estado:** **seed ejecutado OK** en staging (2026-07-09)  
**Restricciones:** no producción, no DNS, no deploy, no modificar schema

---

## Resumen de ejecución (2026-07-09)

| Resultado | Detalle |
| --------- | ------- |
| **Seed** | OK — datos mínimos creados/asegurados en Neon staging |
| **IDs** | fotógrafo `id=1`, admin `id=2`, álbum `id=1`, blog post `id=1` |
| **Counts** | users staging = 2 · albums demo = 1 · photos seed = 3 · blog posts = 1 · AppConfig `id=1` |
| **HTTP preview** | Rutas responden 200 pero **Deployment Protection** de Vercel devuelve «Login – Vercel» (no valida app anónima) |

---

## Credenciales staging (solo QA)

| Cuenta | Email | Rol |
| ------ | ----- | --- |
| Fotógrafo | `fotografo.staging@clf.dnx.test` | `PHOTOGRAPHER` |
| Admin | `admin.staging@clf.dnx.test` | `ADMIN` |

**Password por defecto (solo staging):** `StagingClf2026!`  
Override opcional en runtime: `CLF_STAGING_SEED_PASSWORD` (no commitear).

Imprimir credenciales en terminal: `CLF_STAGING_SEED_PRINT_CREDENTIALS=1` (omitido por defecto).

---

## Archivos del seed

| Archivo | Rol |
| ------- | --- |
| `apps/compramelafoto/scripts/staging/seed-minimal.ts` | Orquestación idempotente |
| `apps/compramelafoto/scripts/staging/staging-db-bridge.ts` | Bridge SQL para gap schema/cliente |

- Usa `@repo/db` (`prisma` compartido del monorepo).
- Idempotente: `upsert` por email/slug; fotos por `originalKey` estable.
- Guardas: `ALLOW_CLF_STAGING_MINIMAL_SEED=1`, bloqueo de hosts producción, sin `VERCEL_ENV=production`.

---

## Bridge SQL (gap schema / cliente Prisma)

En staging Neon, **no todas las migraciones del schema Prisma están aplicadas**. El cliente generado espera columnas que aún no existen en DB, por ejemplo:

| Modelo | Columna faltante (ejemplo) |
| ------ | -------------------------- |
| `User` | `cuantoCobroUser` |
| `Album` | `cleanupStatus` |
| `Photo` | `thumbWatermarkedKey` |

`prisma.user.upsert()` / `album` / `photo` fallan con `P2022` (columna inexistente).

**Solución:** `staging-db-bridge.ts` inserta/actualiza vía `$queryRaw` solo columnas presentes en la DB staging actual. Modelos sin gap (`AppConfig`, `BlogPost`, `PhotographerSalesSettings`, etc.) siguen usando Prisma ORM.

Esto **no modifica el schema**; es un workaround operativo hasta alinear migraciones.

---

## Datos que crea o asegura

### AppConfig (id=1)

- `minDigitalPhotoPrice`: 5000  
- `platformCommissionPercent`: 10  
- `maintenanceMode`: false  

### Álbum público

| Campo | Valor |
| ----- | ----- |
| `publicSlug` | `staging-clf-demo-album` |
| `title` | Álbum demo staging CLF |
| `enableDigitalPhotos` | true |
| `digitalPhotoPriceCents` | 5000 |
| `termsVersion` | `2026-01-26` |

### Fotos (×3)

Placeholders `placehold.co`, keys `staging/clf-minimal-v1/photo-0N.jpg`. No sube a R2.

### Blog (opcional)

| Campo | Valor |
| ----- | ----- |
| `slug` | `staging-clf-bienvenida` |
| `status` | `PUBLISHED` |
| `noIndex` | true |

Omitir: `CLF_STAGING_SEED_SKIP_BLOG=1`.

---

## Cómo ejecutarlo (staging)

### Prerequisitos

- `DATABASE_URL` y `DIRECT_URL` de **staging** (Vercel Preview o `dnx-mcp/.env.local`).
- Migración blog gap aplicada: `20260706190000_add_clf_blog_marketing_gap`.
- Cliente Prisma generado: `pnpm --filter @repo/db run db:generate`

### Comando

`pnpm exec tsx` **no está disponible** en el paquete `compramelafoto`; usar `tsx` desde `@repo/db`:

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/apps/compramelafoto"

export DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
export DIRECT_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
export ALLOW_CLF_STAGING_MINIMAL_SEED=1

# tsx desde el contexto correcto (@repo/db)
"../../packages/db/node_modules/.bin/tsx" scripts/staging/seed-minimal.ts
```

Alternativa equivalente desde la raíz del monorepo:

```bash
pnpm --filter @repo/db exec tsx apps/compramelafoto/scripts/staging/seed-minimal.ts
```

(Con `DATABASE_URL` / `DIRECT_URL` ya exportadas en el shell.)

---

## Limitación: Deployment Protection (Vercel)

Smoke HTTP anónimo contra preview (`compramelafoto-dnxsuite-…vercel.app`) devuelve **HTTP 200** con HTML «Login – Vercel», no la app ni JSON de `/api/public/albums`.

Validación manual requiere:

- Navegador con sesión Vercel del equipo, o  
- Bypass (`VERCEL_AUTOMATION_BYPASS_SECRET` / cookie de protection bypass) en probes automatizados.

**No implica fallo del seed** — los datos están en Neon staging.

---

## Próximos pasos

1. **Bypass Deployment Protection** — habilitar prueba automatizada o manual autenticada del preview.
2. **Completar env preview** — R2, MP sandbox, Resend, AWS (portadas reales, checkout MP).
3. **Resolver migración fallida** — `20260708150000_organizer_direct_mp_commission_ledger` (`EventOrganizerCommissionStatus` faltante); `prisma migrate resolve` + fix antes de próximos deploys.
4. **Alinear schema staging** — aplicar migraciones pendientes para poder retirar el bridge SQL cuando DB y cliente Prisma coincidan.

---

## Re-ejecución

Seguro ejecutar de nuevo: actualiza filas existentes sin duplicar (claves estables por email, `publicSlug`, `originalKey`).

---

## Relacionado

- `compramelafoto-staging-database-setup.md` (dnx-mcp)  
- `compramelafoto-blog-migration-staging-apply.md` (dnx-mcp)  
- `compramelafoto-preview-runtime-diagnostic.md` (dnx-mcp)
