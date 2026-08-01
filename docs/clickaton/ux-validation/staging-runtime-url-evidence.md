# Evidencia runtime de URLs — Imp. 05

**Host:** `https://clickaton-staging.vercel.app`  
**Deployment:** `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr`  
**Fecha:** 2026-08-01

## Fuente de verdad

Helper: `apps/clickaton/lib/site/public-origin.ts` → `resolveClickatonPublicOrigin`.

Orden: `CLICKATON_PUBLIC_URL` → `CLICKATON_PUBLIC_WEB_BASE_URL` → `NEXT_PUBLIC_APP_URL` → `APP_URL` → heurística Vercel staging → `siteConfig.url`.

## Valor runtime staging

| Variable (proyecto `clickaton-staging`, env Production) | Valor efectivo observado |
|----------------------------------------------------------|---------------------------|
| `CLICKATON_PUBLIC_URL` | `https://clickaton-staging.vercel.app` (set; Encrypted) |
| `CLICKATON_PUBLIC_WEB_BASE_URL` | mismo host |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | mismo host |

HTML home:

* `<link rel="canonical" href="https://clickaton-staging.vercel.app">`
* `og:url` = `https://clickaton-staging.vercel.app`

Detalle maratón:

* canonical / og:url = `https://clickaton-staging.vercel.app/maratones/clickaton-argentina-2026`

## Checkout returns

Con `CLICKATON_PUBLIC_URL` staging, `readiness:mp-test` marca:

* `publicOrigin`: **pass**
* `returnUrls`: **pass** (guard URLs no ve producción)

Bloqueos restantes son credenciales/flags, no host de return.

## Email links

Origen resuelto con URL staging en readiness local simulada: `https://clickaton-staging.vercel.app`.  
No se enviaron correos. Audiencia producción no forzada por host staging.

## Robots / sitemap

| Recurso | Resultado |
|---------|-----------|
| `/robots.txt` | `Disallow: /` (staging noindex) |
| `/sitemap.xml` | 404 (sin sitemap público activo) |

## Hosts detectados (HTML público)

| Host | Home | Detalle maratón | Login | Clasificación |
|------|------|-----------------|-------|---------------|
| `clickaton-staging.vercel.app` | 8 | 8 | 8 | Correcto (canónico) |
| `maratonfotografica.com` | 0 | 0 | 0 | Ausente (OK) |
| `clickaton-dnxsuite` | 0 | 0 | 0 | Ausente (OK) |
| `localhost` | 0 | 0 | 0 | Ausente (OK) |
| Preview efímero como canonical | no | no | no | OK |

## Guard runtime (config efectiva staging)

```
CLICKATON_PUBLIC_URL=https://clickaton-staging.vercel.app
… (mismas bases)
VERCEL_PROJECT_NAME=clickaton-staging
```

* `guard:staging-urls` / assert con `expectStaging`: PASS  
* `readiness:mp-test` origin: staging; returnUrls pass; status ≠ READY por credenciales  
* `readiness:resend-staging` origin: staging; status BLOCKED por dry-run/allowlist/key/webhook  

## Resultado

**PASS** para URL canónica runtime de staging.  
No aparecen URLs productivas incorrectas en metadata/HTML inspeccionado.
