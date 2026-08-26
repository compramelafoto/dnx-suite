# Alineación staging ↔ producción — Imp. 08

**Fecha:** 2026-08-03

```text
CODE TIP: staging alias = dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR (SEO/footer + base 3dfbfa7)
COMMERCIAL FUNNEL PARITY: YES via fixture ar2026-commercial-ux-test
AR2026 PRODUCTIVE SLUG ON STAGING: still closed (intentional)
SEO/FOOTER ON STAGING ALIAS: YES
PRODUCTION: not modified
```

| Dimensión | Staging | Producción |
| --------- | ------- | ---------- |
| Alias | `clickaton-staging.vercel.app` → `dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR` | `maratonfotografica.com` (sin deploy Imp08) |
| Funnel comercial UX | Fixture `ar2026-commercial-ux-test` $25k/$35k + remera + FAQ | AR2026 real |
| Slug `clickaton-argentina-2026` | Inscripción no disponible (kill switch) | Abierta |
| Sitemap/robots/footer | En alias; robots `Disallow: /`; sitemap vacío | Pendiente decisión deploy |
| Base | `ep-round-fog…` | `ep-silent-haze…` |

## Recomendación

1. Commit/push del patch limpio para retiros futuros vía `deploy:staging:safe` (sin prebuilt).  
2. No abrir AR2026 real en staging.  
3. Deploy productivo SEO solo con autorización humana.
