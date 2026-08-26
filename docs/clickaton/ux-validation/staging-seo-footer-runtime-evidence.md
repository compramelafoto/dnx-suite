# Evidencia runtime SEO + footer — Imp. 08 staging

**Fecha:** 2026-08-03  
**Alias:** `https://clickaton-staging.vercel.app`  
**Deployment:** `dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR`  
**Proyecto:** `clickaton-staging` (`prj_MM6Bkdi8…`)

## Robots

| Campo | Valor |
| ----- | ----- |
| Status | 200 |
| Cuerpo | `User-Agent: *` / `Disallow: /` |
| Sitemap prod referenciado | **no** |
| Staging indexable | **no** |

## Sitemap

| Campo | Valor |
| ----- | ----- |
| Status | 200 |
| Política | urlset vacío mientras `allowIndexing=false` |
| Host productivo | **no** |
| Fixture `ar2026-commercial-ux-test` | **excluido** |
| Admin / mi-cuenta / login / checkout | **no** |

Justificación: staging no indexable; preferencia restrictiva (sin rutas parciales). No se considera error.

## Footer

| Campo | Valor |
| ----- | ----- |
| Copy | “Consultá las maratones abiertas y viví una experiencia fotográfica diferente.” |
| CTA | “Ver maratones” → `/maratones` |
| Copy obsoleto “sin inscripciones…” | **ausente** |
| Home / maratones / detalle / inscripción | visible |

## Metadata / hosts

| Check | Resultado |
| ----- | --------- |
| `noindex` en HTML público staging | presente |
| Hosts `maratonfotografica.com` en robots/sitemap | no |
| Helper | `resolveSearchIndexing` + project id staging + fallback ambiguo → noindex |

## Viewports (Playwright)

| Viewport | Overflow X | Footer CTA | FAQ (inscripción) |
| -------- | ---------- | ---------- | ----------------- |
| 320×568 | no | sí | sí |
| 360×800 | no | sí | sí |
| 390×844 | no | sí | sí |
| 430×932 | no | sí | sí |
| 1280×800 | no | sí | sí |

## Funnel fixture (HTML)

| Check | Resultado |
| ----- | --------- |
| `$25.000` / `$35.000` | sí (inscripción) |
| Labels Antes/Ahora en HTML | sí |
| Remera + talles | sí |
| FAQ | sí |

## Resultado

`PASS` — SEO staging no indexable; footer nuevo en alias; funnel fixture operativo.
