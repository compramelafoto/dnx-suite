# Deploy seguro Imp. 04 → staging — Imp. 05

**Palabra clave:** `Clickatón UX`  
**Fecha:** 2026-08-01  
**Estado etapa:** `PARTIAL` (P2 runtime cerrados; MP/Resend siguen bloqueados externamente)

## Precondiciones

| Check | Resultado |
|-------|-----------|
| Proyecto Vercel | `clickaton-staging` |
| Project ID | `prj_MM6Bkdi8***` |
| Link `apps/clickaton/.vercel` | staging (no raíz `clickaton-dnxsuite`) |
| Base Neon | `fragrant-union-80829821` / host `ep-round-fog…` / db `neondb` |
| Alias productivo `maratonfotografica.com` | no modificado |
| Meta LIVE | off |
| Credenciales MP productivas en esta ejecución | no usadas |
| Destinatarios reales Resend | no configurados para envío |
| `deploy:staging:guard` | PASS |
| `guard:staging-urls` | PASS |
| Build local | PASS |

## Variables de URL (solo staging / Production del proyecto staging)

Reconfirmadas / seteadas a `https://clickaton-staging.vercel.app`:

* `CLICKATON_PUBLIC_URL`
* `CLICKATON_PUBLIC_WEB_BASE_URL`
* `APP_URL`
* `NEXT_PUBLIC_APP_URL`
* `AUTH_URL`

No se tocaron variables del proyecto productivo `clickaton-dnxsuite`.

## Guard deploy

* Comando: `pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy`
* Target verificado: `clickaton-staging`
* Abort message path intacto (no se desactivó)

## Deploy

| Campo | Valor |
|-------|-------|
| Project name | `clickaton-staging` |
| Project ID | `prj_MM6Bkdi8***` |
| Target Vercel | `production` del proyecto staging (alias producto staging) |
| Deployment ID (H1 fix) | `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr` |
| Deployment URL | `https://clickaton-staging-3nikju408-compramelafotos-projects.vercel.app` |
| Alias estable | `https://clickaton-staging.vercel.app` |
| Build Vercel | READY |
| Promoción a `maratonfotografica.com` | No |
| Commit / push | No |

Nota: un deploy previo en la misma Imp. 05 (`dpl_4BEdRJM5…`) quedó reemplazado por el redeploy del H1 restaurado en la rama no-credential / helper.

## Smoke

| Ruta | Resultado |
|------|-----------|
| `/api/public/health/db` | 200 · `ok` · `ep-round-fog…` · 12 ediciones publicadas |
| `/`, `/maratones`, detalle AR 2026, `/login` | 200 |
| `/mi-cuenta` | 200 (shell; auth en cliente/sesión) |
| `/admin/*` protegidas | 307 → `/login?next=…` |
| `/admin/finanzas/cuenta-owner` (admin) | 200 empty state |
| 404 público / admin | 404 real |
| P2022 registro | no observado |
| `systemSlidesConfig` en build logs | warning Prisma SSG home banners (P3 residual; build OK) |

## H1

Runtime fixture confirmado: **«Inscripción de TEST UX Confirmado»** (1× H1, no vacío).  
Fallbacks parcial / edición / neutro: unit tests PASS. Fixture empty sin link a detalle.

## Canonical / URLs

Home: `canonical` + `og:url` = `https://clickaton-staging.vercel.app`  
Detalle maratón: canonical/og bajo el mismo host.  
`maratonfotografica.com` / `localhost` / `clickaton-dnxsuite` en HTML home/detalle/login: **0**.

## cuenta-owner

Onboarding off → HTTP 200, H1 «Cuenta que recibirá los pagos», copy empty state, links a Mi cuenta de cobro + diagnóstico. Sin soft-404. Noperm → acceso denegado. Anon → login.

## Tests

* Typecheck PASS · H1 tests PASS · public-ux / card-brick / global-ux PASS  
* Selfchecks admin-auth / funnel-11b / dnx-payments-checkout PASS  
* E2E público+auth+env (con fixtures TEST UX): 30 PASS  
* E2E MP/Resend: skipped / BLOCKED (readiness ≠ READY)  
* Build local PASS  

## Bloqueos externos

* `BRICK_STAGING_BLOCKED` — faltan credenciales TEST / collector / webhook / flags  
* `RESEND_STAGING_BLOCKED` — faltan dry-run / allowlist / key / webhook seguros  

## Riesgos

* Drift schema `systemSlidesConfig` en banners home (no bloquea health ni funnels).  
* Índice `/admin/finanzas` sigue 404 (rutas canónicas son `…/mi-cuenta` y `…/cuenta-owner`).  
* Fixture participante empty sin inscripción visible.

## Confirmaciones

Sin pagos · sin correos · sin Meta LIVE · sin prod · sin commit · sin push · sin cambios de auth/permisos/APIs/Prisma/lógica de negocio.
