# DNX Partners — ETAPA 04 / IMPLEMENTACIÓN 05 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE` (con residuales autenticados documentados)  
**Alcance:** preparación + migrate + deploy productivo FotoRank / Santa Fe en Foco (Sponsors).

---

## 1. Estado general

Sponsors institucional operativo en **FotoRank producción** (`fotorank.dnxsuite.com`):

- Backup Neon verificado → migrate institutional roles aplicada.
- Artefacto aislado (worktree) sin WIP Clickatón/CLF/InfoSpot.
- Deploy production **READY** + alias canónico.
- SFEF seed: SFPR `ORGANIZER` + Cámara de Senadores `CO_ORGANIZER`.
- Landing pública renderiza grupos **Organizan** / **Coorganizan**.

No staging. No Clickatón deploy. No banners / InfoSpot / CLF.

---

## 2. Rama / SHA

| Campo | Valor |
|-------|-------|
| Rama | `feat/fotorank-super-admin-09b` |
| Commit base (HEAD worktree) | `43553fbdfe89bdcbd5a0c8db6c24b3e3cf060ea0` |
| Artefacto | Worktree `/tmp/dnx-fr-partners-imp05` = HEAD + overlay Partners/Sponsors FR |

---

## 3. WIP detectado

Working tree principal (~276 paths dirty): Clickatón Tienda, Communications, landing `contest-public` WIP, etc.

**No** se reseteó ni se usó `git add .`.  
Deploy desde worktree limpio + overlay acotado.

---

## 4. `@ts-nocheck`

**Mantenido temporalmente** en `packages/db/src/partners-prisma-repository.ts`.

**Por qué (estructural, no cosmético):** el schema Prisma local aún no declara modelos de assets (`dnxPartnerAsset` / participation assets) ni `accessKey` tipados que el dominio `@repo/partners` ya usa en métodos de assets/eligibility. Eliminar `@ts-nocheck` sin sync de schema implica errores masivos o casts globales.

Los métodos institucionales (Stage 04) sí alinean con schema + migración `20260807120000`.  
Typecheck `@repo/partners` y `fotorank` (`tsc --noEmit`) **PASS**. No bloquea deploy.

---

## 5. pnpm / store

| Campo | Valor |
|-------|-------|
| `packageManager` | `pnpm@9.0.0` |
| Acción | `corepack enable` + `corepack prepare pnpm@9.0.0 --activate` |
| Install | `pnpm install --frozen-lockfile` en worktree → OK |
| Nota | Store local regenerado; no se forzó cambio de lockfile por versión incorrecta |

---

## 6–11. Validaciones pre-deploy

| Check | Resultado |
|-------|-----------|
| Tests `@repo/partners` | **72/72 PASS** |
| Typecheck `@repo/partners` | PASS |
| Typecheck FotoRank (`tsc --noEmit`) | PASS |
| Lint archivos Sponsors tocados | PASS (tras declarar `FOTORANK_PARTNERS_PUBLIC_ENABLED` en `turbo.json`) |
| Prisma validate | PASS (warning preexistente SetNull) |
| Prisma generate | PASS |
| Build FotoRank local | PASS (incluye `/dashboard/concursos/[id]/sponsors`) |
| Build Vercel | PASS |

---

## 12–14. Migraciones + backup FotoRank prod

### Identidad DB (confirmada)

| Campo | Valor sanitizado |
|-------|------------------|
| Neon project | `compramelafoto` (`divine-hall-10689679`) |
| Branch Neon | `development` (**es** el branch productivo de FR en Vercel) |
| Host | `ep-dawn-dew…` |
| Database | `neondb` |
| Vercel | `fotorank-dnxsuite` → `https://fotorank.dnxsuite.com` |

**Denylist:** `ep-round-fog` (staging), `ep-silent-haze` (Clickatón prod).

### Backup Neon (verificado **antes** de migrate)

| Campo | Valor |
|-------|-------|
| Name | `backup-fotorank-partners-prod-pre-imp05-20260807` |
| Id | `br-fragrant-base-ad24cuvm` |
| Parent | `development` @ compramelafoto |
| Estado | `ready` |

### Migración aplicada

Pendiente real única: `20260807120000_dnx_partner_institutional_roles` → **aplicada** con `prisma migrate deploy` (script allowlisted `partners:migrate:fotorank-production`).

Sin `db push` / `migrate dev` / reset.

---

## 15–17. Deploy FotoRank producción

| Campo | Valor |
|-------|-------|
| Proyecto | `fotorank-dnxsuite` (`prj_Fe2IBVwihehY4FwS9zePCfs4RdxP`) |
| Deployment ID | `dpl_AH7hgbpDLxt7TFubibEBeiGbiwoT` |
| URL | `https://fotorank-dnxsuite-eopdw5lvs-compramelafotos-projects.vercel.app` |
| Alias producción | `https://fotorank.dnxsuite.com` (+ fotorank.com) |
| Estado | **READY** |
| SHA base | `43553fbd` + overlay Imp 05 |
| Rollback código | deployment anterior `dpl_FPLZaoFoXSp6sacgrkhGbW5zkbQw` (`fotorank-dnxsuite-e6u6days9…`) |
| Rollback DB | branch Neon `br-fragrant-base-ad24cuvm` (no destructivo sin análisis) |
| Kill-switch UI | `FOTORANK_PARTNERS_PUBLIC_ENABLED=false` oculta sección pública |

**No** se desplegó Clickatón.

---

## 18–22. Admin Sponsors / modelo

Ruta: `/dashboard/concursos/[id]/sponsors`  
Link desde dashboard del concurso: **Sponsors y organizadores**.

Capacidades de código (Imp 04/05): vincular/crear partner, rol institucional, `displayTier`, `displayOrder`, `publicRoleLabel`, aportes, logos (`logoUrl`), activar/archivar.

Smoke autenticado interactivo del formulario: **pendiente de sesión operador** (HTTP auth wall verificado → login).

Roles disponibles: `ORGANIZER`, `CO_ORGANIZER`, `INSTITUTIONAL_SPONSOR`, `MAIN_SPONSOR`, `SPONSOR`, `COLLABORATOR`, `STRATEGIC_PARTNER`, `MEDIA_PARTNER`, `SUPPLIER` (este último oculto en landing por default).

---

## 23–28. Santa Fe en Foco

| Entidad | Rol | Tier | Order | Status |
|---------|-----|------|-------|--------|
| Sociedad de Fotógrafos Profesionales de Rosario | `ORGANIZER` | `INSTITUTIONAL` | 10 | `CONFIRMED` |
| Cámara de Senadores de la Provincia de Santa Fe | `CO_ORGANIZER` | `INSTITUTIONAL` | 20 | `CONFIRMED` |

**Nota denominación:** en bases/copy pueden figurar ambos como “organizadores”. En modelo de datos Imp 05 la Cámara queda como `CO_ORGANIZER` (no sponsor). Si la documentación institucional vigente exige otra etiqueta pública, ajustar solo `publicRoleLabel` / rol sin inferir por aporte.

Sponsors secundarios: **ninguno inventado**. Admin listo para agregar cuando se confirmen.

Landing (`/concursos/santa-fe-en-foco`):

- Sección **Instituciones y aliados**
- Grupo **Organizan** → SFPR
- Grupo **Coorganizan** → Cámara de Senadores
- Logos: fallback tipográfico (sin `logoUrl` / asset aún) — MVP no bloqueado

---

## 29–35. Regresión / smoke

| Superficie | Resultado |
|------------|-----------|
| Home | HTTP 200, dpl nuevo |
| Login | HTTP 200 |
| Health DB | `ok`, host `ep-dawn-dew…`, contests presentes |
| Landing SFEF | grupos partners OK |
| Inscripción | redirige a login con mensaje de continuidad (comportamiento esperado sin sesión) |
| Upload / confirmación / admisión | **no ejercidos con sesión** en Imp 05; sin cambios de flags |
| Jurado / resultados | no tocados |

---

## 36. Rollback disponible

1. **Código:** promover `dpl_FPLZaoFoXSp6sacgrkhGbW5zkbQw` o redeploy SHA previo.  
2. **UI partners:** `FOTORANK_PARTNERS_PUBLIC_ENABLED=false`.  
3. **DB:** restaurar desde `br-fragrant-base-ad24cuvm` solo tras análisis (no rollback destructivo automático).

---

## 37. Riesgos restantes

1. `@ts-nocheck` adapter hasta sync schema assets/eligibility.  
2. Logos institucionales sin asset/`logoUrl` (fallback texto).  
3. Smoke autenticado admin Sponsors + upload SFEF pendiente.  
4. Tensión naming ORGANIZER vs copy “organizadores” para Cámara.  
5. Working tree principal sigue con WIP ajeno grande (no mezclar en próximos deploys).  
6. Warnings Vercel turbo: `EMAIL_FROM`, `FOTORANK_OPS_SMOKE_SECRET` no declarados (preexistente / no bloqueante).

---

## 38. Archivos clave (overlay Imp 05)

- `packages/partners/**` (institutional + tests)
- `packages/db/prisma/migrations/20260807120000_dnx_partner_institutional_roles/**`
- `packages/db/src/partners-prisma-repository.ts`
- `packages/db/scripts/partners-migrate-fotorank-production.mts`
- `packages/db/scripts/seed-sfef-partners-production.mts`
- `apps/fotorank/app/lib/fotorank/partners/**`
- `apps/fotorank/app/(dashboard)/dashboard/concursos/[id]/sponsors/page.tsx`
- `apps/fotorank/app/components/contest-public/ContestPartnersSection.tsx` (standalone, sin DS WIP)
- `apps/fotorank/app/concursos/[slug]/page.tsx` (carga grupos + sección)
- `apps/fotorank/app/globals.css` (estilos `.fr-contest-partner-*`)
- `turbo.json` (`FOTORANK_PARTNERS_PUBLIC_ENABLED`)

---

## 39. % estimado MVP Sponsors (FR / SFEF)

**~90%** del MVP Sponsors para FotoRank / Santa Fe en Foco (admin + landing + roles + prod).

Pendiente para 100%: logos autorizados, smoke autenticado admin/upload, sync schema para quitar `@ts-nocheck`, sponsors secundarios cuando existan confirmaciones.

---

## 40. Próximo paso

**Deploy Clickatón producción** (Sponsors Imp 04 ya migrado en Clickatón DB; falta artefacto/deploy aislado + smoke edición).

No abrir features nuevas. No staging Sponsors.
