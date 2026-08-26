# Inventario patch limpio — Imp. 08

**Base:** `3dfbfa7`  
**Worktree:** `/Users/danielcuart/Desktop/PROGRAMACIONES/clickaton-ux-imp08-staging`  
**Fecha:** 2026-08-03

| Archivo | Tipo | Motivo | Dependencias | Incluido | Riesgo |
| ------- | ---- | ------ | ------------ | :------: | ------ |
| `apps/clickaton/app/sitemap.ts` | runtime | sitemap; vacío si no indexable; excluye fixtures | `search-indexing`, `listPublicMarathons` | sí | bajo |
| `apps/clickaton/app/robots.ts` | runtime | robots por audiencia; `force-dynamic` | `search-indexing` | sí | bajo |
| `apps/clickaton/lib/seo/search-indexing.ts` | runtime | guard indexación host/proyecto/fallback | `public-origin` | sí | medio (seguridad SEO) |
| `apps/clickaton/lib/seo/search-indexing.test.ts` | test | staging/prod/ambiguous | — | sí | — |
| `apps/clickaton/lib/seo/build-sitemap-entries.test.ts` | test | exclusión fixture TEST | — | sí | — |
| `apps/clickaton/components/layout/SiteFooter.tsx` | runtime | copy atemporal + CTA | navigation/site | sí | bajo |
| `apps/clickaton/components/layout/SiteFooter.test.ts` | test | anti “sin inscripciones” | — | sí | — |
| `apps/clickaton/next.config.ts` | runtime/deploy | tracing `sharp` linux-x64/arm64 para prebuilt mac | sharp optional | sí* | medio (solo deploy prebuilt) |

\*Dependencia mínima demostrada: sin tracing/binarios linux, detalle con `next/image` devolvía 500 en prebuilt.

## Excluidos

| Archivo / área | Motivo |
| -------------- | ------ |
| Seed `ar2026-commercial-ux` | Fixture ya sembrado en `ep-round-fog` |
| Partners / Sponsors WIP | Ajeno a Imp08 |
| Paquetes compartidos no SEO | Fuera de alcance |
| Prisma schema / migraciones | Prohibido |
| Lockfile | Sin cambio justificado |
| `.env` / `.local` / credenciales | Secretos |
| Screenshots | No necesarios |
| Docs WIP no relacionadas | Ruido |
| Código MP / Resend / Meta | Prohibido |

## Diffstat

```text
robots.ts | SiteFooter.tsx | next.config.ts  (modificados)
sitemap.ts | SiteFooter.test.ts | lib/seo/*     (nuevos en base 3dfbfa7)
```
