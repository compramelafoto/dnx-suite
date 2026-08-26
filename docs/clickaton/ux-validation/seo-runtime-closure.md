# Cierre SEO runtime — Imp. 07 + Imp. 08 staging

**Fecha:** 2026-08-03

## Sitemap

| Ítem | Detalle |
| ---- | ------- |
| Archivo | `apps/clickaton/app/sitemap.ts` (`force-dynamic`) |
| Staging (alias Imp08) | 200; urlset vacío; sin prod; sin fixture TEST |
| Producción | **pendiente deploy**; diseño: host `maratonfotografica.com`; sin fixtures |
| Excluidos | admin, mi-cuenta, login, checkout, `*test*`, piloto, demo |

## Robots

| Entorno | Comportamiento |
| ------- | -------------- |
| Staging host / project id staging | `Disallow: /` (verificado en alias Imp08) |
| Fallback ambiguo (sin PUBLIC_URL) | noindex (`AMBIGUOUS_ORIGIN_FALLBACK`) |
| Producción (`maratonfotografica.com` + PUBLIC_URL explícito) | allow `/`; disallow admin/api/mi-cuenta/login; sitemap prod |
| Guard | `lib/seo/search-indexing.ts` |

## 404 HTTP

Rutas inexistentes → **HTTP 404** + “No encontramos esta página” (staging Imp08 PASS).

## Tests

* `lib/seo/search-indexing.test.ts` (incl. project id staging + fallback)  
* `lib/seo/build-sitemap-entries.test.ts`  
* `SiteFooter.test.ts`

## Estado por entorno

| Entorno | SEO Imp07/08 |
| ------- | ------------ |
| Staging alias | **desplegado** (`dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR`) |
| Producción comercial | **no desplegado** — no marcar resuelto |
