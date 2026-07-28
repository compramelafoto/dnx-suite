# RELEASE 10A — Matriz de variables de entorno

**Fecha:** 2026-07-28  
**Regla:** sin valores secretos; solo nombre / entorno / presencia / last4 seguro / origen / consumidor.  
**Script:** `pnpm clickaton:release:check-env` (`CLICKATON_RELEASE_ENV=local|staging|production|…`)

## Herramientas de auditoría usadas

| Fuente | Resultado |
|--------|-----------|
| `apps/clickaton/.env.local` | presente (local) |
| Vercel `clickaton-staging` | listado nombres Production/Preview |
| Vercel `clickaton-dnxsuite` | listado nombres Production/Preview |
| MCP `vercel_prepare_staging` | error de schema (`type: sensitive`) — parcial |
| Auth0 | N/A |
| GCP secrets | no consultado en profundidad (Clickatón no catalogado) |

---

## Leyenda presencia

- **L** = local `.env.local` Clickatón (scan 10A)  
- **S** = Vercel proyecto `clickaton-staging`  
- **P** = Vercel proyecto `clickaton-dnxsuite` (production host)  
- **?** = no auditado / no listado  
- **—** = no aplica / ausente esperado

Presencia Vercel basada en `vercel env ls` (solo nombres). Preview staging casi vacío (solo 2 vars).

---

## Matriz principal

| Nombre | Req | Sensible | Local | Staging | Preview(S) | Production | Formato / notas | Consumidor |
|--------|-----|----------|-------|---------|------------|------------|-----------------|------------|
| `DATABASE_URL` | Sí todos | Sí | present | present | ? | present | postgres URL | Prisma |
| `GOOGLE_CLIENT_ID` | Sí auth | No | present …`.com` | **absent** | ? | present | OAuth client id | `@repo/auth` |
| `GOOGLE_CLIENT_SECRET` | Sí auth | Sí | present | **absent** | ? | present | secret | `@repo/auth` |
| `GOOGLE_REDIRECT_URI` | No | No | — | — | — | — | URL exacta opcional | auth |
| `COOKIE_DOMAIN` | Rec. prod SSO | No | — | — | — | — | `.dominio` | session |
| `CLICKATON_PUBLIC_WEB_BASE_URL` | Sí | No | present …`3005` | **absent** | — | present | URL | public/auth |
| `CLICKATON_PUBLIC_URL` | Sí staging+ | No | — | present | — | **absent** | HTTPS público | checkout/emails |
| `APP_URL` | Sí | No | present …`3005` | present | — | present | URL | app |
| `AUTH_URL` | Staging tiene | No | — | present | — | — | URL | auth helpers |
| `AUTH_SECRET` | Staging | Sí | — | present | — | — | random | session/crypto |
| `NEXT_PUBLIC_APP_URL` | Staging | No | — | present | — | — | URL pública | client |
| `CLICKATON_PUBLIC_DATA_SOURCE` | Rec. | No | example=`fixture` | present | — | — | `fixture`\|`fotorank` | public data |
| `DNX_ENVIRONMENT` | Rec. | No | — | present | — | — | staging/prod | gates |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | Staging | No | — | present | — | — | `manual`\|`mercado_pago_test` | checkout |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Test/staging | Sí | — | present | present | — | TEST only | payments |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Test/staging | No | — | present | — | — | TEST pk | payments |
| `MERCADOPAGO_CREDENTIALS_SOURCE` | Test | No | — | present | — | — | attestation | payments |
| `MERCADOPAGO_TEST_BUYER_EMAIL` | Smoke | No | — | present | — | — | email test | smoke |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | Sí staging+ | Sí | — | present | present | **absent** | HMAC | webhook |
| `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` | Sí staging+ | No | — | present | — | **absent** | HTTPS | MP notify |
| `CRON_SECRET` | Sí staging+ | Sí | — | present | — | **absent** | bearer | crons |
| `CLICKATON_CRON_SECRET` | Fallback | Sí | — | present | — | **absent** | bearer | crons |
| `CLICKATON_QR_TOKEN_SECRET` | Rec. | Sí | — | present | — | — | HMAC QR | credentials |
| `CLICKATON_ALLOW_SEARCH_INDEXING` | Staging | No | — | present | — | — | bool | SEO |
| `CLICKATON_STAGING_DEPLOYED_SHA` | Meta | No | — | present | — | — | sha | QA |
| `CLICKATON_MP_CLIENT_ID` | OAuth | No | — | **absent** | — | **absent** | id | owner oauth |
| `CLICKATON_MP_CLIENT_SECRET` | OAuth | Sí | — | **absent** | — | **absent** | secret | owner oauth |
| `CLICKATON_MP_REDIRECT_URI` | OAuth | No | — | **absent** | — | **absent** | HTTPS callback | owner oauth |
| `CLICKATON_MP_WEBHOOK_SECRET` | Opcional | Sí | — | — | — | — | firma MP | webhooks |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | OAuth vault | Sí | — | **absent** | — | **absent** | key material | vault |
| `DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED` | Gate | No | — | **absent** | — | **absent** | flag | oauth UI |
| `DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED` | Gate LIVE | Sí | — | — | — | — | flag | oauth |
| `FOTORANK_PUBLIC_API_BASE_URL` | Si data=fotorank | No | — | — | — | — | HTTPS | sync/public |
| `R2_*` / storage welcome | Welcome cards | Sí | — | — | — | — | S3 compat | media |
| `CLICKATON_EMAIL_TEST_TO` | Emails test | No | — | — | — | — | email | notifications |
| `CLICKATON_EMAIL_ALLOW_ANY` | Peligroso | No | — | — | — | — | `true` solo controlado | notifications |
| `CLICKATON_EMAIL_FALLBACK_TO` | Fallback TEST | No | — | — | — | — | email | notifications |
| `RESEND_API_KEY` | Envío real | Sí | — | — | — | — | API key | `@repo/auth` email |
| `EMAIL_FROM` / `DNX_EMAIL_FROM` | Remitente | No | — | — | — | — | `Name <addr>` | email |
| `DNX_SOCIAL_PUBLISHER_LIVE` | Gate publish | No | — | — | — | — | debe quedar off en 10A | social cron |
| `AUTH0_*` | No usar | — | — | — | — | — | N/A | — |

### Ejemplo no secreto

| Variable | Ejemplo |
|----------|---------|
| `CLICKATON_PUBLIC_URL` | `https://clickaton-staging.vercel.app` |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | `mercado_pago_test` |
| `CLICKATON_PUBLIC_DATA_SOURCE` | `fixture` |
| `MERCADOPAGO_CREDENTIALS_SOURCE` | `credenciales_de_prueba` |

---

## Detección de mezcla TEST/LIVE

| Señal | Hallazgo 10A |
|-------|--------------|
| Provider `mercado_pago_production` | No visto en listados |
| MCP `isTestPrefix: false` en token TEST | **WARNING / posible BLOCK** |
| Prod project sin vars TEST (ok) pero también sin webhook/cron | **BLOCKED** para readiness prod |
| Staging con TEST tokens en env Production del proyecto staging | Esperado para proyecto staging; no confundir con prod LIVE |

---

## Validación por script

```bash
# Local (usa .env.local merge)
pnpm clickaton:release:check-env

# Simular target staging (inyectar names via env del shell sin imprimir secrets)
CLICKATON_RELEASE_ENV=staging pnpm clickaton:release:check-env

CLICKATON_RELEASE_ENV=production pnpm clickaton:release:check-env
```

Exit code ≠ 0 si hay bloqueos (ausencias críticas, URLs inválidas, localhost en prod, sospecha TEST/LIVE).

---

## Huecos críticos por entorno

### Local

Presentes: `DATABASE_URL`, Google, bases localhost.  
Faltan para OAuth/vault/pagos: MP client, master key, webhook (OK si solo UI).

### Staging (`clickaton-staging`)

**Bloqueos:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ausentes → Tammy/Daniel no pueden login Google en staging.  
Presentes: DB, TEST MP, webhook, crons, provider.

### Production (`clickaton-dnxsuite`)

Presentes: DB, Google, `APP_URL`, `CLICKATON_PUBLIC_WEB_BASE_URL`.  
**Ausentes listados:** webhook, cron, payments provider, MP OAuth, `CLICKATON_PUBLIC_URL`.  
Correcto **no** tener tokens LIVE aún; incorrecto pretender checkout/cron listos.

### Preview

Staging preview: casi vacío. Production preview: DB + Google. No usar preview URLs para LIVE.
