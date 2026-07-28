# RELEASE 10A — Matriz de URLs

**Fecha:** 2026-07-28  
**Hosts canónicos**

| Entorno | Host | Proyecto Vercel | Health deploy (MCP) |
|---------|------|-----------------|---------------------|
| Production | `https://maratonfotografica.com` (+ `www`) | `clickaton-dnxsuite` | Production deployment READY histórico; último preview CANCELED |
| Staging | `https://clickaton-staging.vercel.app` | `clickaton-staging` | **ERROR** (último build) |
| Local | `http://localhost:3005` | — | — |

---

## Clickatón

| Uso | Path | Método | Staging URL | Production URL | Protección / notas |
|-----|------|--------|-------------|----------------|--------------------|
| Home | `/` | GET | `https://clickaton-staging.vercel.app/` | `https://maratonfotografica.com/` | público |
| Login unificado | `/login` | GET | …`/login` | …`/login` | DNX |
| Panel admin | `/admin` | GET | …`/admin` | …`/admin` | sesión + allowlist |
| Edición admin | `/admin/ediciones/[editionId]` | GET | path | path | admin |
| Finanzas edición | `/admin/ediciones/[editionId]/finanzas` | GET | path | path | finance grants |
| Cuenta owner MP | `/admin/finanzas/cuenta-owner` | GET | path | path | flag OAuth; `notFound` si OFF |
| Inscripción pública | `/maratones/[slug]/inscripcion` | GET | path | path | **no abrir venta en 10A** |
| Pago return UI | `/maratones/[slug]/inscripcion/pago` | GET | path | path | query status |
| Resumen | `/maratones/[slug]/inscripcion/resumen/[registrationId]` | GET | path | path | token `t` |
| Mi cuenta inscripción | `/mi-cuenta/inscripciones/[id]` | GET | path | path | sesión |
| Success/pending/failure | mismas rutas return + query | GET | back_urls checkout | back_urls | hosts allowlist MP |
| OAuth MP connect | `/api/clickaton/payments/mercadopago/connect` | GET | staging host | prod host | admin + flags |
| OAuth MP callback | `/api/clickaton/payments/mercadopago/callback` | GET | **exact redirect** | **exact redirect** | state/PKCE |
| OAuth revoke/reconnect | `…/revoke`, `…/reconnect` | POST | | | admin |
| Webhook DNX Payments | `/api/webhooks/dnx-payments` | POST | staging | prod | HMAC secret |
| Cron holds | `/api/cron/expire-registration-holds` | GET | vercel cron `*/15` | debe existir en prod | Bearer / `x-vercel-cron` |
| Cron FotoRank | `/api/cron/fotorank-sync` | GET | `*/5` | idem | auth cron |
| Cron welcome | `/api/cron/welcome-cards` | GET | `*/5` | idem | auth cron |
| Cron social | `/api/cron/social-publish` | GET | `*/5` | idem | **no auto-publish social en 10A** |
| Public timeline | `/api/public/editions/[slug]/timeline` | GET | | | público |
| Public prompts | `/api/public/editions/[slug]/prompts` | GET | | | público |
| Public now | `/api/public/editions/[slug]/now` | GET | | | público |
| Profile photo | `/api/public/registration/profile-photo` | POST? | | | registro |
| Healthcheck | *(no ruta dedicada auditada)* | — | — | — | **gap** — usar home/deploy READY |

Trailing slash: Next App Router — preferir **sin** slash final en redirects registrados en Google/MP.

`www` vs apex: ambos dominios verificados en Vercel prod; callbacks deben registrarse para el host **canónico** usado en `CLICKATON_PUBLIC_*` (documentado: apex `maratonfotografica.com`).

---

## Auth (DNX / Google — no Auth0)

| Uso | URL |
|-----|-----|
| Start Google | `{origin}/api/auth/google` |
| Callback Google local | `http://localhost:3005/api/auth/google/callback` |
| Callback Google staging | `https://clickaton-staging.vercel.app/api/auth/google/callback` |
| Callback Google prod | `https://maratonfotografica.com/api/auth/google/callback` |
| Logout | invalida `dnx_session` → `/` |
| Issuer / audience Auth0 | **N/A** |

Allowed origins: flujo redirect server-side; registrar redirect URIs en Google Cloud. Staging callback **debe** añadirse si se prueba staging.

---

## Mercado Pago

| Uso | Staging | Production |
|-----|---------|------------|
| OAuth redirect URI | `https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback` | `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| Notification / webhook | `https://clickaton-staging.vercel.app/api/webhooks/dnx-payments` | `https://maratonfotografica.com/api/webhooks/dnx-payments` |
| Back URLs checkout | derivadas de `CLICKATON_PUBLIC_URL` + paths inscripción/pago | idem prod URL |
| LIVE en preview URL | **Prohibido** | — |

---

## Verificaciones 10A

| Check | Resultado |
|-------|-----------|
| HTTPS staging/prod | OK en URLs canónicas |
| Localhost en production vars | no listado en prod Google/APP |
| Preview URL en LIVE OAuth | no configurar |
| Rutas OAuth/webhook/cron existen en repo | **Sí** |
| Staging deploy sano | **NO** (ERROR) |
| Firma webhook verificable e2e | no re-ejecutada; código + tests payments OK |
| Healthcheck dedicado | **ausente** → WARNING |

---

## www

Si el usuario cae en `www.maratonfotografica.com`, asegurar redirect a apex **antes** de OAuth o registrar ambos callbacks (preferible un solo canónico).
