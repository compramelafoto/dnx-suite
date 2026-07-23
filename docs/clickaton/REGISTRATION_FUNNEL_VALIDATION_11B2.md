# CLICKATÓN — ETAPA 11B2 — VALIDACIÓN OPERATIVA DEL FUNNEL TEST

**Fecha:** 2026-07-23  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD validación:** `1b2de05` (11B presente en local)  
**Staging deploy observado:** commit pre-11B (`2b66279` / alias preview)  
**Push:** no · **Deploy productivo:** no · **Producción:** no modificada

---

## Resultado ejecutivo

La validación operativa **no pudo cerrarse**.

Bloqueantes inequívocos:

1. **DATABASE_URL de staging no disponible para ops** (`vercel env pull` → valor vacío / tipo `sensitive`).
2. **DATABASE_URL local clasificada `unknown`** (`neon_without_staging_or_test_marker`) → **seed NO ejecutado** (fail-closed).
3. **Staging público no incluye el código 11B** → `/maratones/piloto-test-11b` = **404**; Home sigue con “próximamente”.
4. **Resend / `CLICKATON_EMAIL_TEST_TO` ausentes** en staging pull y local.
5. **CRON_SECRET / secretos QR / AUTH_SECRET** ausentes en staging pull.

No se inventaron resultados E2E de pago/free/hold/email.

---

## Entorno

| Ítem | Valor |
|---|---|
| URL staging | `https://clickaton-staging.vercel.app` |
| Proyecto Vercel | `clickaton-staging` |
| Código en staging | pre-`1b2de05` (validado por smoke + `vercel_status`) |
| Código local | `1b2de05` |
| Evidencia local | `.local/audit-11b2/` (gitignored) |

---

## Dependencias (sin secretos)

| Dependencia | Presente | Entorno | Acción requerida (Daniel) |
|---|---:|---|---|
| URL staging | sí | Vercel | — |
| `DATABASE_URL` staging usable | no | Vercel pull vacío | Pegar URL staging real con marcador `staging`/`clickaton_staging` en Vercel `clickaton-staging` y en `.env` local gitignored |
| Clasificador smoke DB local | fail | local Neon `neondb` | No usar para seed; reemplazar por staging inequívoco |
| `CLICKATON_SEED_PILOT` | no | — | Exportar `=1` al sembrar |
| `RESEND_API_KEY` | no | staging+local | Configurar en Vercel + local; dominio/remitente Resend |
| `CLICKATON_EMAIL_TEST_TO` | no | — | Casilla TEST controlada (único destino) |
| `CRON_SECRET` / `CLICKATON_CRON_SECRET` | no | — | Bearer para `/api/cron/expire-registration-holds` |
| `CLICKATON_QR_TOKEN_SECRET` | no | — | O secret de sesión/registration ≥16 chars |
| `AUTH_SECRET` | no | — | Sesión / Mi cuenta |
| `MERCADOPAGO_TEST_*` | sí (staging) | Vercel | Presentes (encrypted); no usados en esta corrida |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | sí | staging = `mercado_pago_test` | OK |
| Playwright (Clickatón app) | no | — | Smoke usó Playwright temporal en `.local/audit-11b2` |
| Deploy 11B en staging | no | — | Autorizar deploy staging de `1b2de05` (sin prod, sin push si se usa `vercel deploy` local) |

### Instrucción exacta — email

Configurar **sin commitear** en Vercel `clickaton-staging` (Preview + Production del proyecto staging) y opcionalmente `apps/clickaton/.env.local`:

1. `RESEND_API_KEY`
2. Remitente/dominio verificado en Resend (según `@repo/auth` / Identity email)
3. `CLICKATON_EMAIL_TEST_TO` = inbox TEST controlada

### Instrucción exacta — seed staging

1. Obtener `DATABASE_URL` / `DIRECT_URL` del Neon **staging** (nombre de DB preferido: `clickaton_staging` u host/path con `staging|stg|preview|test|sandbox`).
2. Verificar: el clasificador `classifySmokeDatabaseUrl` debe devolver `safeForTestSmoke: true`.
3. `CLICKATON_SEED_PILOT=1 pnpm --filter clickaton seed:pilot-edition` (dos veces; idempotente).
4. Confirmar slug `piloto-test-11b` visible en UI del deploy que incluya 11B.

---

## Smoke público (staging actual)

Evidencia: `.local/audit-11b2/smoke-staging-results.json` + screenshots.

| Ruta | HTTP | Hallazgo |
|---|---:|---|
| `/` | 200 | “próximamente”; sin piloto; robots `noindex, nofollow` |
| `/maratones` | 200 | sin piloto |
| `/maratones/piloto-test-11b` | **404** | “Maratón no encontrada” |
| `/legal/terminos` | 200 | legales pre-11B (sin versión funnel 11B) |
| `/mi-cuenta` | 200 | responde (login/flujo previo) |
| `/robots.txt` | 200 | `Disallow: /` |

Desktop + mobile: mismos hallazgos estructurales.

---

## Casos E2E (pago / free / hold / email / Mi cuenta / QR)

**NO EJECUTADOS** — bloqueados por seed staging + código 11B no desplegado en staging + email ausente.

---

## Suites técnicas (código local `1b2de05`)

| Suite | Resultado |
|---|---|
| `selfcheck:qr-token` | OK |
| `selfcheck:registration-funnel-11b` | OK (`emailSkipped: true`) |
| `selfcheck:public-registration-hardening` | OK |
| `selfcheck:dnx-payments-checkout` | OK |
| lint clickaton | OK |
| prisma validate | OK |
| typecheck clickaton | 6 errores residuales `@repo/payments` (preexistentes / I1; no bloquean selfchecks) |
| build clickaton | no requerido ante bloqueo seed |
| E2E browser funnel | NO |

---

## Bugs encontrados

### Bloqueantes (ops / entorno)

- Seed staging imposible (DB URL no clasificable / pull vacío).
- Staging sin build 11B → journey UI no validable en URL real.
- Email TEST no configurado.

### Altos / medios / bajos (producto)

Ningún bug de código 11B reproducido en E2E (no hubo E2E). Smoke confirma gap de deploy/seed, no regresión nueva.

---

## Decisiones de seguridad tomadas

- No se sembraron datos en Neon local sin marcador staging.
- No se imprimieron secretos ni `DATABASE_URL`.
- No se tocó WIP ajeno ni producción.
- Artefactos en `.local/` gitignored.

---

## Veredicto 11B2

**BLOQUEADO — SEED STAGING NO DISPONIBLE**

GO/NO GO: **NO GO — JOURNEY TEST INCOMPLETO**

Reanudar 11B2 cuando Daniel entregue:

1. `DATABASE_URL` staging clasificable,  
2. deploy staging con `1b2de05` (sin prod),  
3. `RESEND_API_KEY` + `CLICKATON_EMAIL_TEST_TO`,  
4. `CRON_SECRET` + secretos QR/sesión.

---

## Flags (confirmación)

```
OWNER ONBOARDING OFF
CHECKOUT DNX PAYMENTS PRODUCTION OFF
ORDERS CREATE PRODUCTION OFF
ORDERS OBSERVE PRODUCTION OFF
PRODUCTION ORDERS OFF
FINANCIAL IDENTITY LEGACY_ONLY
CLICKATON_ALLOW_SEARCH_INDEXING OFF
```

## Producción

**PRODUCCIÓN NO MODIFICADA**
