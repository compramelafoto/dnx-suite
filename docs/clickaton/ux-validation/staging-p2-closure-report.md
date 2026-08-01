# Cierre residuales P2 — Imp. 04 + runtime Imp. 05

**Palabra clave:** `Clickatón UX`  
**Fecha:** 2026-08-01  
**Estado:** `PARTIAL` (P2 de presentación/URL/cuenta-owner **cerrados en staging**; Brick/Resend externos bloqueados)

## H1 vacío

| Campo | Detalle |
|-------|---------|
| Ruta | `/mi-cuenta/inscripciones/[id]` |
| Causa | H1 = `firstName lastName` sin fallback; rama sin credential solo tenía `h2` |
| Corrección | `buildRegistrationDetailHeading` en ambas ramas de la página |
| Test | `lib/public-ux/registration-detail-heading.test.ts` (5 PASS) |
| Runtime | «Inscripción de TEST UX Confirmado» en `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr` |

## URL canónica

| Campo | Detalle |
|-------|---------|
| Helper | `lib/site/public-origin.ts` |
| Staging canónico | `https://clickaton-staging.vercel.app` |
| Guard | `guard:staging-urls` PASS |
| Runtime | canonical + og:url staging; 0× `maratonfotografica.com` en HTML inspeccionado |

## Soft-404 `cuenta-owner`

| Campo | Detalle |
|-------|---------|
| Corrección | Empty state si onboarding off |
| Runtime | HTTP 200 · panel no habilitado · links canónicos · sin `notFound()` |

## Rutas residuales

* Diagnóstico canónico: `/admin/integraciones/diagnostico` (200).  
* Finanzas: `/admin/finanzas/mi-cuenta` + `/admin/finanzas/cuenta-owner`.  
* Índice `/admin/finanzas` → 404 real (P3 / documentado; no soft-404 de cuenta-owner).

## Selfchecks / deploy

| Check | Resultado |
|-------|-----------|
| admin-auth / funnel-11b / dnx-payments-checkout | PASS |
| Deploy staging Imp. 04 | **Hecho** (`dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr`) |
| Commit / push | No |

## Riesgos abiertos

* MP/Resend readiness externos.  
* Warning Prisma `systemSlidesConfig` en build SSG.
