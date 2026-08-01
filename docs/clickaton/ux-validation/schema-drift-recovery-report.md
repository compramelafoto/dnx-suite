# Schema drift recovery — Etapa 03 Imp. 02

**Palabra clave:** `Clickatón UX`  
**Fecha:** 2026-08-01  
**Estado:** `DONE` (schema staging recuperado; funnel ya no bloqueado por P2022)  
**URL staging:** `https://clickaton-staging.vercel.app`  
**Deployment staging:** `dpl_6Q942pMuz31pwcAtNv8xCikrJvxM`

---

## Causa raíz

El cliente Prisma del deploy esperaba la columna `ClickatonEdition.coverImageVerticalUrl`, pero la migración correspondiente **no estaba aplicada** en Neon staging (`ep-round-fog`).

Error runtime: Prisma `P2022` → HTTP 500 en `/maratones` y detalle.

## Schema esperado

En `packages/db/prisma/schema.prisma` (modelo `ClickatonEdition`):

```prisma
/// Portada vertical (stories / mobile banner).
coverImageVerticalUrl    String?
```

| Propiedad | Valor |
|-----------|--------|
| Tipo | `String?` → SQL `TEXT` |
| Nullability | nullable |
| Default | ninguno |
| Índices | no |
| Relaciones | no |

Seguro para las 11 ediciones existentes (aditivo, nullable, sin backfill).

## Migración

| Pregunta | Respuesta |
|----------|-----------|
| ¿Campo en schema? | Sí |
| ¿Migración en repo? | Sí — **no se creó una nueva** |
| Nombre | `20260801010000_clickaton_edition_cover_vertical` |
| Commit origen | `72abe3b` (`feat(clickaton): portadas H/V…`) |
| SQL | `ALTER TABLE "ClickatonEdition" ADD COLUMN IF NOT EXISTS "coverImageVerticalUrl" TEXT;` |
| ¿`db push`? | No |

### SQL aplicado (set pendiente completo)

Además de la columna, `migrate deploy` aplicó 4 migraciones aditivas pendientes legítimas:

1. `20260731170000_clickaton_edition_status_reprogrammed` — `ADD VALUE IF NOT EXISTS 'REPROGRAMMED'`
2. `20260801010000_clickaton_edition_cover_vertical` — columna vertical
3. `20260801120000_dnx_communication_webhook_events` — tabla webhook events
4. `20260801180000_clickaton_home_banners` — tabla banners
5. `20260801200000_clickaton_home_banner_carousel_settings` — settings carousel

Ninguna destructiva. Sin DROP/TRUNCATE/renames.

## Base objetivo (sanitizada)

| Campo | Valor |
|-------|--------|
| Proyecto Neon | `fragrant-union-80829821` (`dnx-suite-staging`) |
| Host | `ep-round-fog…` (pooler/direct identity) |
| Database | `neondb` |
| Confirmación staging | Classifier `dnx_staging_identity_host` + health `/api/public/health/db` |
| Denylist prod | `ep-dawn-dew` **no** usado |
| Match Vercel staging | Health staging reporta el mismo host fingerprint |

**No** se usó `apps/clickaton/.env.local` ni `packages/db/.env` (ambos clasifican production denylist).

## Backup

| Campo | Valor |
|-------|--------|
| Branch Neon | `backup-before-ux03-cover-vertical-20260801` |
| Branch id | `br-plain-dawn-a4fx8igt` |
| Parent | default `production` del proyecto staging |
| Nota | `neonctl` imprimió URI de conexión en CLI local — **no** documentar/secretar aquí; rotar si el log se filtró |

## Migraciones

| Momento | Estado |
|---------|--------|
| Previo | 5 pendientes (listadas arriba) |
| Acción | `pnpm exec prisma migrate deploy` con `DATABASE_URL`/`DIRECT_URL` identity staging |
| Duración | ~13 s |
| Posterior | `Database schema is up to date!` (99 migraciones) |

## Verificación de columna y datos

| Check | Resultado |
|-------|-----------|
| Columna existe | Sí — `text`, `is_nullable=YES`, default null |
| Publicadas | **11** (sin pérdida) |
| Total | 11 |
| `coverImageVerticalUrl` no nulos | **0** (sin valores inventados) |

## Resiliencia (workaround Imp. 01)

Revertido el swallow silencioso:

- Listado: errores de DB → error boundary (no empty fingido)
- Detalle: `notFound()` solo si slug ausente
- Home / UpcomingEvents: idem

Conservado: links legales `/legal/*`, boundary ES, E2E smoke.

Test: `public marathons error visibility` en `test:global-ux`.

## Tests / build

| Check | Resultado |
|-------|-----------|
| `prisma generate` | OK |
| Typecheck | OK |
| `test:public-ux` / `commercial-ux` / `global-ux` | PASS |
| E2E smoke | 16/16 PASS |
| Build local | PASS |
| Deploy staging | READY `dpl_6Q942pMuz31pwcAtNv8xCikrJvxM` |

## Deploy

- Staging: deploy desde workspace con `VERCEL_PROJECT_ID=prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa` → alias `clickaton-staging.vercel.app`
- **Incidente controlado:** un intento previo desde `.vercel` de monorepo apuntó a `clickaton-dnxsuite` y **falló en build** (`Error`); alias productivo `maratonfotografica.com` permaneció en `dpl_85AhnatxoQzzYXJuKJ1kbqyhXjV9` (no promovido)
- Producción: **no migrada**, **no promovida**

## Smoke post-recuperación

Ver `staging-post-recovery-smoke.md`.

Resumen: health ok, `/maratones` 200 con cards, detalle 200, slug inexistente 404, legales OK, sin leak Prisma en HTML.

## Logs P2022

- Históricos pre-migración: presentes
- Tras migrate + redeploy staging: rutas públicas recuperadas; muestra sobre nuevo deploy sin P2022 en el sample filtrado

## Bloqueos restantes (no schema)

- Credenciales admin/participante de prueba
- Brick / pagos TEST (`BRICK_STAGING_BLOCKED` por credenciales, no por schema)
- Inscripción muestra “Inscripción no disponible” (config comercial / ventanas — no P2022)
- `LEGAL_REVIEW` / `FINANCE_REVIEW` / `COMMERCIAL_REVIEW` intactos

## Rollback

Cambio aditivo nullable: **no eliminar la columna**.

Si hubiera regresión de app: rollback de deployment staging vía Vercel al deploy anterior (`dpl_D7fYFmTao2TixSZVLuuBKQqqnnLj` o preview sano).  
Restauración de datos: branch Neon `br-plain-dawn-a4fx8igt`.

## Commit / push

**No** se hizo commit ni push.
