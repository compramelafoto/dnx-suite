# 60 — Cierre migración perfiles + smoke autenticado (Etapa 22H)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE`** (con pendientes de dominio y cron-with-secret)  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**HEAD repo:** `5a231a1` · **Production health version:** `1dc8831` · `db:ok`

No incluye emails ni secretos. Google Cloud **no** configurado. `infospot.com.ar` **no** lanzado.

> El archivo `57-*.md` ya documenta onboarding de perfiles; este informe de cierre 22H usa **60**.

---

## 1. Matriz migración `dnx_public_profiles`

| Aspecto | Resultado |
|---------|-----------|
| Migración encontrada | `20260714010000_dnx_public_profiles_and_infospot_preferences` |
| Presente en repo | Sí (`packages/db/prisma/migrations/…`) |
| Commit origen | `27b6028` feat(db): add DnxUserProfile and InfoSpotUserPreferences |
| Aplicada en staging | **Sí** · schema up to date (`ep-dawn-dew…`) |
| Aplicada en production | **Sí** · schema up to date (`ep-bitter-salad…`) — ya en 22R-C ([`59`](./59-public-profiles-production-migration.md)) |
| SQL auditado | Sí |
| Destructiva | **No** (`SAFE_ADDITIVE`) |
| Bloquea build por | Histórico 22G: Prisma Client sin enums `DnxPublicProfile*` (schema/migración no alineados en ese HEAD) |
| Acción recomendada | **Ninguna migrate deploy** — ya aplicada; `prisma generate` + typecheck/build |

### SQL (resumen)

- `CREATE TYPE` ×3: `DnxPublicProfileType|Status|Source`
- `CREATE TABLE` ×2: `DnxUserProfile`, `InfoSpotUserPreferences`
- Índices UNIQUE + FK a `User` `ON DELETE CASCADE`
- **Sin** DROP / TRUNCATE / DELETE de datos

---

## 2. Typecheck / build / tests

| Check | Resultado |
|-------|-----------|
| `prisma validate` | OK |
| `prisma generate` | OK |
| `prisma migrate status` staging/prod | **Database schema is up to date** |
| `infospot check-types` | **OK** (exit 0) |
| `infospot build` | **OK** |
| `compramelafoto` tsc / build | **OK** |
| `test:r2-cleanup` / editorial / coverage / public-coverage / post-login | **OK** |
| `infospot lint` | **FAIL** avisos turbo `CLF_R2_*` no declarados (preexistente etapa 58; 0 errors, max-warnings 0) |

---

## 3. Director autorizado

| Check | Resultado |
|-------|-----------|
| `INFOSPOT_DIRECTOR` ACTIVE | **2** |
| Password login | **0** (solo OAuth Google) |
| Smoke auth | Sesión corta `dnx_session` mintada en DB Production para Director existente (sin crear usuario nuevo); destruida al cleanup |

---

## 4. Smoke autenticado (alias Vercel)

| Paso | Resultado |
|------|-----------|
| `/redaccion` | **200** |
| `/redaccion/asistente` | **200** |
| Crear DRAFT (`/redaccion/nueva?directo=1`) | **303** → editar · status DRAFT |
| Upload portada | **201** · Biblioteca muestra cover |
| Upload inline | **201** · asset en editor |
| Galería | Upload autenticado + `usageType=GALLERY` · UI editor: Biblioteca / Portada / Galería **OK** |
| Preview autenticado | **200** · badge preview · crédito presente |
| CORS asset | **200** · ACAO alias |
| Secretos en HTML | **Ausentes** |
| Publicar | **No** |

Nota galería: el RPC `Next-Action` de `selectEditorialPhotoAction` no se resolvió desde chunks sin browser; el material se subió por API autenticada Production y el slot GALLERY se verificó en Biblioteca.

---

## 5. Crons

| Endpoint | Sin secret | Con secret |
|----------|------------|------------|
| `clf-events-sync?dryRun=1&limit=3` | **401** | `PENDING_SENSITIVE_EXPORT` (Vercel type=sensitive no exportable por CLI) |
| `reconcile-public-coverage` | **401** | Idem |

---

## 6. Cleanup

| Ítem | Resultado |
|------|-----------|
| R2 keys smoke (5) | Delete **200** · GET **404** |
| Artículo DRAFT + assets | Eliminados · leftover 0 |
| Sesión smoke | Eliminada |
| Leak público `smoke-22h-auth` | **False** en home/noticias/eventos/sitemap |

---

## 7. Redeploy

No requerido en esta etapa: migración ya aplicada (22R-C); cambios versionables = documentación. Production sigue Ready · health `db:ok` · version `1dc8831`.

---

## 8. Readiness

| Área | Estado |
|------|--------|
| R2 multimedia | `VERIFIED_WORKING` (22G + esta reconfirmación auth) |
| Migración perfiles | **Alineada** staging + prod |
| Typecheck/build Info Spot | **OK** |
| Smoke autenticado editorial | **OK** (DRAFT; no publicado) |
| Cron con secreto | Pendiente export sensitive / operador |
| Dominio `infospot.com.ar` | **NO-GO** (DNS / OAuth día D / Search Console) |
| Google Cloud | **No configurado** |

**Launch readiness alias Vercel:** operativo para redacción/multimedia internos.  
**Go-live dominio propio:** bloqueado por DNS/OAuth/Search Console (fuera de esta etapa).
