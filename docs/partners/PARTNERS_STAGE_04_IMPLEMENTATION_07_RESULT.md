# DNX Partners — ETAPA 04 / IMPLEMENTACIÓN 07 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE`  
**Alcance:** cierre productivo Sponsors / DNX Partners en **Clickatón producción**.

Cierra el **MVP prioritario Sponsors agosto — FotoRank + Clickatón**.

---

## 1. Estado general

Sponsors operativo en Clickatón producción (`maratonfotografica.com`):

- Identidad Neon/Vercel verificada (`ep-silent-haze` / `clickaton_production`).
- Backup Imp 07 verificado.
- Migraciones Partners: **up to date** (0 pending; ya aplicadas en Imp 04).
- Artefacto aislado + kill-switch público + labels/logo resolver.
- Deploy production **READY**.
- Admin global + por edición en el build.
- Sin sponsors ficticios creados.
- Auto-sync writes **no** activado.

---

## 2. Estado previo

Código Imp 04 ya tenía admin + roles institucionales + `MarathonSponsors` + aportes/premios.  
DB Clickatón ya migrada (Imp 04). **Faltaba deploy app + kill-switch + cierre.**

---

## 3. Identidad Neon

| Campo | Valor |
|-------|-------|
| App | Clickatón PRODUCTION |
| Neon project | `clickaton-production` |
| Project ID | `bitter-math-56019731` |
| Branch | `production` (`br-billowing-paper-aw1nrj9t`) |
| Host | `ep-silent-haze…` |
| Database | `clickaton_production` |

Denylist: `ep-round-fog`, `ep-dawn-dew` (FR).

---

## 4. Identidad Vercel

| Campo | Valor |
|-------|-------|
| Project | `clickaton-dnxsuite` |
| Project ID | `prj_wo7NXldJbGlkklHnxPjRtdd9xDn0` |
| Alias | `https://maratonfotografica.com` |
| Root Directory | `apps/clickaton` |

---

## 5. Backup

| Campo | Valor |
|-------|-------|
| Name | `backup-clickaton-partners-prod-pre-imp07-20260807` |
| Id | `br-holy-frog-awpbidyp` |
| Parent | `production` (`br-billowing-paper-aw1nrj9t`) |
| Project | `bitter-math-56019731` |
| Estado | `ready` |

Backup Imp 04 previo: `br-damp-rain-awj86hh9`.

---

## 6–9. Migraciones

`prisma migrate status` (host `ep-silent-haze`, DB `clickaton_production`): **Database schema is up to date.**

| Migración Partners | Estado | Necesaria |
|--------------------|--------|-----------|
| `20260802120000_dnx_partners_domain` | APPLIED | Sí |
| `20260802150000_dnx_partner_benefit_access` | APPLIED | Sí |
| `20260802160000_dnx_partner_assets` | APPLIED | Sí |
| `20260803120000_dnx_partner_benefit_eligibility` | APPLIED | Sí |
| `20260803180000_dnx_partner_benefit_auto_sync_caps` | APPLIED | Sí |
| `20260807120000_dnx_partner_institutional_roles` | APPLIED | Sí |

**Pendientes:** 0. **Aplicadas en Imp 07:** ninguna.

---

## 10. Prisma post

Validate/generate PASS. Columnas institucionales y tablas `DnxPartner*` presentes (Imp 04).

---

## 11–12. Aislamiento / pnpm

- Worktree: `/tmp/dnx-ck-partners-imp07` @ `43553fbd` + overlay Partners/Clickatón Sponsors.
- `pnpm@9.0.0` + frozen-lockfile (lockfile ROOT alineado a deps `@repo/partners` en `@repo/db`).

---

## 13–19. Validaciones

| Check | Resultado |
|-------|-----------|
| Tests `@repo/partners` | **72/72 PASS** |
| Tests landing CK (kill-switch + grouping) | **2/2 PASS** |
| Typecheck Partners | PASS |
| Typecheck Clickatón | PASS |
| Lint tocados | PASS |
| Build Clickatón | PASS (rutas `/admin/sponsors*`, edición sponsors) |
| Secret scan | PASS (sin URLs reales en overlay) |

---

## 21–35. Producto

| Capacidad | Estado |
|-----------|--------|
| Admin global `/admin/sponsors` | Operativo (código + deploy) |
| Admin por edición | Operativo |
| Roles / tier / order / labels | Operativo |
| `requiresPayment=false` | Operativo (default / descriptivo) |
| Aportes + soft-link premios | Operativo |
| Logos | `resolvePartnerPrimaryLogo` (assets[] vacío → `logoUrl` → placeholder) |
| Beneficios / auto-sync | Compila; **writes OFF** |
| Público | `listEditionPartnerPublicGroups` + `MarathonSponsors` |
| Kill switch | `CLICKATON_PARTNERS_PUBLIC_ENABLED` (`false` oculta bloque; default on) |

Sin carga de sponsors inventados (Vicario, etc. solo como casos soportados por el modelo).

---

## 36–37. Deploy

| Campo | Valor |
|-------|-------|
| Deployment ID | `dpl_Bye7V7vKRpwbvj8zcikzkQUAgJ6t` |
| URL | `https://clickaton-dnxsuite-m5m1kbspe-compramelafotos-projects.vercel.app` |
| Alias | `https://maratonfotografica.com` |
| Estado | **READY** |
| Rollback código | `dpl_HUoMybKC2FgH3WkUL3aTEwYgfwh2` |

---

## 38–43. Smoke

| Superficie | Resultado |
|------------|-----------|
| Home / login / maratones | 200, dpl nuevo |
| Edición `clickaton-argentina-2026` | 200 |
| Inscripción | 200 |
| Tienda | 200 |
| `/admin/sponsors` | 200 auth wall |
| Health DB | ok, host `ep-silent-haze` |
| Pagos reales | no ejecutados (no destructivo) |

---

## 44. Rollback

1. Código: promover `dpl_HUoMybKC2FgH3WkUL3aTEwYgfwh2`.  
2. DB: `br-holy-frog-awpbidyp` (solo con análisis).  
3. Público: `CLICKATON_PARTNERS_PUBLIC_ENABLED=false`.

---

## 45–46. Riesgos / FUTURE

**Riesgos:** schema drift assets/`accessKey`/BenefitSyncRun (`@ts-nocheck` en adapter + eligibility-sync); logos sin assets tipados; smoke admin autenticado pendiente; disco local ajustado.

**FUTURE:** banners, placements, QR, redención, analytics, CRM, MP Sponsors, InfoSpot, CLF, FotoOffice, auto-sync writes.

---

## 47. Archivos clave Imp 07

- `apps/clickaton/lib/public/edition-partners-public.ts` (+ test)
- `apps/clickaton/components/marathon/MarathonSponsors.tsx`
- `apps/clickaton/config/admin/navigation.ts` (`sponsorsSync`)
- `turbo.json` (`CLICKATON_PARTNERS_PUBLIC_ENABLED`)
- eligibility-sync/snapshot: `@ts-nocheck` por drift
- Doc: este archivo

---

## 48–50. Cierre MVP

| Métrica | Valor |
|---------|-------|
| % MVP Sponsors Clickatón | **~95%** |
| % MVP prioritario FR + CK | **~95%** (ambos en prod) |
| Recomendación | **Cerrar MVP prioritario Sponsors agosto.** Siguiente: logos autorizados + carga admin de partners reales confirmados + sync schema para quitar `@ts-nocheck`. |
