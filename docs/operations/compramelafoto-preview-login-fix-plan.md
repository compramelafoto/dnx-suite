# ComprameLaFoto — Plan fix login preview (staging)

**Fecha:** 2026-07-09  
**Migración gap:** `20260709120000_add_clf_user_gap_columns`  
**App:** `apps/compramelafoto`  
**Sin producción · sin DNS · sin deploy · sin `migrate deploy` (todavía)**

---

## Problema (dos capas)

| Capa | Síntoma | Causa |
|------|---------|--------|
| 1. Vercel Deployment Protection | `POST /api/auth/login` no devuelve JSON; el cliente hace `res.json()` y falla / muestra error opaco | Preview protegido: HTML «Login – Vercel» o redirect |
| 2. Gap DB staging | `prisma.user.*` puede fallar con **P2022** (columna inexistente), p. ej. `User.cuantoCobroUser` | Schema monorepo (merges legacy) adelantado respecto a migraciones aplicadas en Neon staging |

**Objetivo:** dejar listo el fix para que el login funcione en staging **una vez** superada la protección de Vercel y aplicada la migración gap en Neon staging.

---

## 1. Schema `User` (columnas gap)

Fuente: `packages/db/prisma/schema.prisma` (`model User`).

Columnas presentes en schema y **ausentes** de todas las migraciones SQL previas:

| Columna | Tipo schema | Default / nullabilidad |
|---------|-------------|------------------------|
| `cuantoCobroUser` | `Boolean` | `@default(false)` → `NOT NULL DEFAULT false` |
| `cuantoCobroFirstSeenAt` | `DateTime?` | nullable |
| `cuantoCobroLastSeenAt` | `DateTime?` | nullable |
| `workingCoverageRadiusKm` | `Int?` | nullable (`null` = sin límite) |
| `payoutAlias` | `String?` | nullable |
| `payoutBank` | `String?` | nullable |
| `payoutAccountHolder` | `String?` | nullable |
| `allowUnpaidOrderClientData` | `Boolean` | `@default(false)` → `NOT NULL DEFAULT false` |

Origen: merges legacy Cuánto Cobro + shared cleanup (`docs/architecture/migration/19` y `21`).

---

## 2. Migraciones staging (estado conocido)

Documentado en seed / plan blog (Neon staging `ep-round-fog-…`):

**Aplicadas (históricas):**

1. `20260422085720_init_baseline`
2. `20260422185334_service_leads_subtypes_meta`
3. `20260424022429_add_service_lead_forms`
4. `20260424033104_add_service_lead_form_mode`
5. `20260424162000_add_presential_courses_mvp`
6. `20260428192455_add_evaluaciones_engine`

**Pendientes / gap (no aplicar en este paso):**

| Migración | Rol |
|-----------|-----|
| `20260706190000_add_clf_blog_marketing_gap` | Tablas blog/marketing/leads |
| `20260708150000_organizer_direct_mp_commission_ledger` | Enum commission ledger |
| **`20260709120000_add_clf_user_gap_columns`** | **Columnas `User` faltantes (este fix)** |

El baseline crea `User` **sin** las 8 columnas de la tabla anterior → P2022 cuando el client Prisma las espera (upsert seed, queries sin `select` acotado, etc.).

**Nota:** `POST /api/auth/login` hoy usa `select` acotado (`id`, `email`, `name`, `role`, `password`, `tags`) y un fallback sin `tags`. Aun así, alinear columnas evita fallos en seed, Google auth y cualquier `findUnique` sin select.

---

## 3. Migración creada (no aplicada)

**Path:** `packages/db/prisma/migrations/20260709120000_add_clf_user_gap_columns/migration.sql`

- Solo `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS …`
- Additive, forward-only, defaults seguros
- Idempotente vía `IF NOT EXISTS` (seguro si se reintenta en staging)

**No se ejecutó** `prisma migrate deploy` ni se tocó producción.

---

## 4. Endurecimiento `LoginClient`

**Archivo:** `apps/compramelafoto/app/login/LoginClient.tsx`

Antes de `res.json()`:

1. Leer `Content-Type`.
2. Si no incluye `application/json`, mostrar:

> El preview está protegido por Vercel. Iniciá sesión en Vercel o usá un bypass.

Así un HTML/redirect de Deployment Protection no rompe el parseo ni deja un error genérico de JSON.

---

## 5. Validaciones locales (pre-deploy)

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter compramelafoto typecheck` | ✅ OK |
| `pnpm --filter compramelafoto build` | ✅ OK (warnings preexistentes Prisma/NFT; sin error) |
| `pnpm --filter compramelafoto lint` | ✅ OK (0 errors; warnings preexistentes) |

**No se ejecutó** `prisma migrate deploy`.

---

## 6. Aplicación planificada en staging (cuando se autorice)

**Orden sugerido** (solo Neon staging, nunca prod):

1. Snapshot / backup Neon staging.
2. Superar Vercel Deployment Protection (login Vercel o bypass token de preview).
3. `cd packages/db && pnpm db:migrate:deploy` con `DATABASE_URL` / `DIRECT_URL` de **staging**.
4. Verificar columnas:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'User'
  AND column_name IN (
    'cuantoCobroUser',
    'cuantoCobroFirstSeenAt',
    'cuantoCobroLastSeenAt',
    'workingCoverageRadiusKm',
    'payoutAlias',
    'payoutBank',
    'payoutAccountHolder',
    'allowUnpaidOrderClientData'
  )
ORDER BY 1;
```

5. Smoke: `POST /api/auth/login` con usuario seed staging → JSON 200 + cookie.
6. (Opcional) re-seed si hacía falta el bridge SQL por gap User.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Aplicar en producción por error | No deployar; no apuntar `DATABASE_URL` prod; checklist host Neon staging |
| Columna ya existe en staging | `IF NOT EXISTS` |
| Login sigue fallando tras migrate | Primero confirmar Content-Type JSON (capa Vercel); luego P2022 en logs server |
| Otros gaps (Album/Photo) | Fuera de alcance; ver `compramelafoto-staging-seed.md` bridge |

---

## 8. Próximos pasos

1. Review del SQL + `LoginClient` (este plan).
2. Autorizar `migrate deploy` **solo staging**.
3. QA login preview con protección Vercel resuelta.
4. No push/deploy a producción hasta validación staging.

---

## Referencias

- [`compramelafoto-staging-seed.md`](./compramelafoto-staging-seed.md) — P2022 / bridge SQL
- [`compramelafoto-blog-marketing-migration-plan.md`](./compramelafoto-blog-marketing-migration-plan.md) — migraciones staging aplicadas
- `docs/architecture/migration/19-prisma-cuanto-cobro-report.md`
- `docs/architecture/migration/21-prisma-final-cleanup-report.md`
