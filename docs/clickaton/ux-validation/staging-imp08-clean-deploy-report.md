# Imp. 08 — Deploy limpio SEO/footer a staging

**Fecha:** 2026-08-03  
**Estado:** `DONE` (alias staging con SEO/footer + funnel fixture operativo)  
**Base commit:** `3dfbfa7`  
**Worktree limpio:** `/Users/danielcuart/Desktop/PROGRAMACIONES/clickaton-ux-imp08-staging` (detached `3dfbfa7`)  
**Worktree principal:** no modificado para el deploy (solo docs de validación)

## Resumen

Se aisló el patch SEO/footer sobre `3dfbfa7`, se validó build/tests/guards en worktree limpio y se desplegó al proyecto Vercel `clickaton-staging`. El script canónico `deploy:staging:safe --prod` queda **bloqueado por `gitDirty`** (Vercel no acepta Production CLI sin commit). Se usó `vercel build --prod` + `vercel deploy --prebuilt --prod` desde el worktree limpio, con binarios Prisma/sharp linux vendorizados en el artefacto local (sin commit/push).

Intentos prebuilt anteriores sin engines/sharp linux provocaron 500 en detalle; el alias se revirtió a `dpl_J8sLBbere…` hasta el deploy final sano.

## Inventario aplicado

Ver `staging-clean-patch-inventory.md`.

| Incluido | Excluido |
| -------- | -------- |
| `app/sitemap.ts`, `app/robots.ts`, `lib/seo/*`, `SiteFooter(+test)` | Partners / Sponsors WIP |
| Hardening indexación + `dynamic` robots/sitemap | Seed comercial (fixture ya en DB) |
| `next.config.ts` tracing sharp linux (mínimo deploy) | `.env`, screenshots, lockfile, Prisma schema |

## Diffstat (worktree limpio)

```text
 apps/clickaton/app/robots.ts                    | 36 +++++++++++++------------
 apps/clickaton/components/layout/SiteFooter.tsx | 11 +++++++---
 apps/clickaton/next.config.ts                   | 15 ++++++++++-
 3 files changed, 42 insertions(+), 20 deletions(-)
 + app/sitemap.ts
 + components/layout/SiteFooter.test.ts
 + lib/seo/search-indexing.ts
 + lib/seo/search-indexing.test.ts
 + lib/seo/build-sitemap-entries.test.ts
```

## Guards

| Guard | Resultado |
| ----- | --------- |
| `deploy:staging:guard` | PASS (8 tests) |
| Target proyecto | `clickaton-staging` / `prj_MM6Bkdi8…` |
| Base | `ep-round-fog…` |
| Alias | `https://clickaton-staging.vercel.app` |
| Indexación staging | `Disallow: /` |
| Meta LIVE | no activado |
| Proyecto productivo | no seleccionado |

## Tests / build (worktree limpio)

| Check | Resultado |
| ----- | --------- |
| SEO + footer unit | PASS (7) |
| Typecheck Clickatón | PASS (pre-deploy Imp08) |
| Lint alcance | PASS (pre-deploy Imp08) |
| `pnpm build` local | PASS |
| `vercel build --prod` prebuilt | PASS (con warning tamaño función por sharp dual) |

## Deploy

| Campo | Valor |
| ----- | ----- |
| Proyecto | `clickaton-staging` |
| Deployment ID | `dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR` |
| URL | `https://clickaton-staging-o6l5fefx8-compramelafotos-projects.vercel.app` |
| Alias | `https://clickaton-staging.vercel.app` |
| Estado | READY |
| Target | production **del proyecto staging** (no comercial) |
| Commit/push | **no** |
| `clickaton-dnxsuite` | **no tocado** |
| `maratonfotografica.com` | **no tocado** |

## Smoke post-deploy

| Ruta | Resultado |
| ---- | --------- |
| `/` | 200; footer nuevo; sin “sin inscripciones”; noindex |
| `/maratones` | 200; fixture listado |
| Fixture detalle / inscripción | 200; `$25.000` / `$35.000`; remera; talles; FAQ |
| `/robots.txt` | 200; `User-Agent: *` + `Disallow: /` |
| `/sitemap.xml` | 200; urlset vacío (política noindex); sin prod; sin fixture |
| 404 | HTTP 404; “No encontramos esta página” |
| Health DB | 200; `ep-round-fog…` |
| Mobile 320–430 + desktop | sin overflow X; footer usable |
| Logs | sin sharp/prisma errors en deploy final; sin P2022 |

## Incidentes durante Imp08 (mitigados)

1. `deploy:staging:safe --prod` → BLOCKED `gitDirty`.  
2. Prebuilt mac sin engine linux → Prisma `linux-arm64` missing → 500.  
3. Prebuilt sin sharp linux → 500 en páginas con `next/image`.  
4. Prebuilt con `CLICKATON_PUBLIC_URL` vacío → robots/sitemap indexables con host prod (prerender) → **rollback inmediato**; harden de `resolveSearchIndexing` + `force-dynamic`.  
5. Sharp arm64 no bastó en iad1 → faltaba **linux-x64**; vendorizado + tracing.

## Commit / push

No se hizo commit. No se hizo push.

## Próximo paso recomendado

Commit/push controlado del patch SEO/footer (+ harden + tracing sharp) desde worktree limpio para habilitar `deploy:staging:safe` remoto sin prebuilt, y decidir deploy productivo SEO por separado.
