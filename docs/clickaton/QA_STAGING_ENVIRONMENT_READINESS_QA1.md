# CLICKATÓN — ETAPA QA1 — PREPARACIÓN DEL ENTORNO STAGING PARA VALIDACIÓN

**Fecha:** 2026-07-24  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD local:** `57395f7` (contiene `1b2de05` 11B)  
**Push:** NO EJECUTADO  
**Deploy productivo (`clickaton-dnxsuite` / `maratonfotografica.com`):** NO TOUCHED  

---

## Resultado ejecutivo

**NO GO — ENTORNO STAGING TODAVÍA INCOMPLETO**  
**Veredicto:** **BLOQUEADO — IDENTIDAD DE DB**

Se avanzó parcialmente:

- Variables staging nuevas (auth/QR/cron/URLs/`DNX_ENVIRONMENT`) cargadas en Vercel `clickaton-staging`.
- Secretos staging generados localmente (`.local/qa1/generated-secrets.env`, gitignored).
- Infra Playwright mínima para QA2 añadida en repo.
- Deploy CLI hacia `clickaton-staging` **quedó en estado UNKNOWN/Building** (sin Ready).
- `DATABASE_URL` de Vercel **sigue sin poder leerse** (`vercel env pull` → vacío) → seed fail-closed.
- Resend / destinatario TEST **ausentes**.

---

## Arquitectura de entornos

| Recurso | Staging | Producción | Aislado |
|---|---|---|---:|
| Proyecto Vercel | `clickaton-staging` (`prj_MM6Bk…`) | `clickaton-dnxsuite` (`prj_wo7NX…`) | sí |
| Dominio | `clickaton-staging.vercel.app` | `maratonfotografica.com` | sí |
| Team | `compramelafotos-projects` | mismo team, proyecto distinto | sí |
| Root Directory | `apps/clickaton` | (prod project) | sí |
| Scope “Production” del proyecto | alias staging (no es prod comercial) | producción comercial | documentado |
| DB (histórica documentada) | Neon `clickaton_staging` / host `ep-divine-smoke-av8hmt7s*` | no usada aquí | — |
| DB (sesión QA1 usable) | **no recuperable vía CLI** | — | **BLOQUEO** |
| MP | `mercado_pago_test` + tokens TEST | LIVE no tocado | sí (flags OFF) |
| Indexación | `robots` Disallow `/` + `CLICKATON_ALLOW_SEARCH_INDEXING=false` | no modificada | sí |

---

## Deployment

| Campo | Valor |
|---|---|
| Estrategia | Worktree limpio `57395f7` + `vercel deploy --prod` al proyecto **solo** `clickaton-staging` |
| Contiene 11B | sí (`1b2de05` ancestro) |
| Intentos | `dpl_GZJm2ySk…`, `dpl_9woHvPQ…` |
| Estado | **UNKNOWN / Building** prolongado; alias público **sigue en SHA pre-11B** (`2b66279`) |
| Producción comercial | no desplegada |

### Por qué CLI deploy falló / colgó

1. Deployments CLI quedaron `UNKNOWN` >5–20 min sin logs de build útiles.  
2. Disco local llegó a 100% durante el proceso (mitigado parcialmente).  
3. Los deploys históricos “Ready” en 1–2 min fueron vía **integración Git** (requiere push).  

**Autorización pedida a Daniel (opción recomendada):** permitir `git push` de `migration-legacy-clf-to-monorepo` **solo** para que Vercel reconstruya `clickaton-staging` (sin promover `clickaton-dnxsuite`).

---

## Base de datos

### Clasificación sesión QA1

**`UNKNOWN_FAIL_CLOSED`**

Motivos:

1. `vercel env pull` de `clickaton-staging` → `DATABASE_URL` longitud 0 (tipo Encrypted/Sensitive no exportable).  
2. `.env.local` apunta a `ep-dawn-dew*` / `neondb` → clasificador smoke: `neon_without_staging_or_test_marker` (**no usar**).  
3. Neon API token local (`~/.config/neonctl`) → **401** (credenciales vencidas).  
4. No se sembrará ni migrará sin URL clasificable.

### Identidad histórica (documentación + auditorías `.local`)

Evidencias independientes (no bastan para ops hoy, pero definen el target):

1. Docs `FINANCIAL_IDENTITY_MIGRATION_APPLY_10D3I_D3.md`: DB `clickaton_staging`, host `ep-divine-smoke-av8hmt7s*`, branch Neon `clickaton-staging`.  
2. Reportes `.local/audit-10d3i-*` con el mismo fingerprint.  
3. Variable `DATABASE_URL` existe en proyecto Vercel `clickaton-staging` (nombre presente; valor no legible).

Hasta re-exportar esa URL a un archivo gitignored y pasar el clasificador → **no seed**.

---

## Variables (proyecto `clickaton-staging`)

| Variable | Configurada | Scope | Observación |
|---|---:|---|---|
| `DATABASE_URL` | sí (Vercel) | prod | **no pullable** — acción Daniel |
| `DIRECT_URL` | no vista | — | añadir si Neon la requiere |
| `DNX_ENVIRONMENT` | sí | prod (+preview intent) | `staging` |
| `CLICKATON_PUBLIC_DATA_SOURCE` | sí | prod | `prisma` |
| `CLICKATON_ALLOW_SEARCH_INDEXING` | sí | prod | `false` |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | sí | prod | staging URL |
| `CLICKATON_PUBLIC_URL` | sí (previa) | | staging URL |
| `AUTH_SECRET` | sí | prod | generado QA1 (gitignored) |
| `CLICKATON_QR_TOKEN_SECRET` | sí | prod | generado QA1 |
| `CRON_SECRET` / `CLICKATON_CRON_SECRET` | sí | prod | generado QA1 |
| `RESEND_API_KEY` | **no** | — | Daniel |
| `EMAIL_FROM` / `DNX_EMAIL_FROM` | **no** | — | Daniel |
| `CLICKATON_EMAIL_TEST_TO` | **no** | — | Daniel |
| `MERCADOPAGO_TEST_*` | sí | | sandbox |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | sí | | `mercado_pago_test` |

Secretos generados: `.local/qa1/generated-secrets.env` (no Git).

---

## Acciones manuales exactas (Daniel)

### A) Recuperar DB staging (bloqueante)

1. Neon Console → proyecto `clickaton-staging` → branch `clickaton-staging`.  
2. Copiar connection string de la DB **`clickaton_staging`** (no `neondb` del host dawn-dew).  
3. En Vercel → `clickaton-staging` → Settings → Environment Variables:  
   - Actualizar `DATABASE_URL` (y `DIRECT_URL` si aplica) con **“Sensitive” desmarcado o valor re-pegado** para que `vercel env pull` funcione en ops, **o**  
   - Entregar el valor solo en archivo local gitignored `.local/qa1/staging.database.env`.  
4. Verificar localmente (sin imprimir URL):

```bash
node -e "const {classifySmokeDatabaseUrl}=require('./apps/clickaton/scripts/lib/classify-smoke-database-url.ts')" # o tsx
# Debe: classification staging|test y safeForTestSmoke true
```

5. Luego:

```bash
export DATABASE_URL=… DIRECT_URL=…
pnpm --filter @repo/db exec prisma migrate status
CLICKATON_SEED_PILOT=1 pnpm --filter clickaton seed:pilot-edition
# repetir segunda vez (idempotencia)
```

### B) Deploy 11B en staging (bloqueante)

**Opción 1 (recomendada):** autorizar push de la rama (sin deploy prod).  
**Opción 2:** liberar ≥5–8 GB disco local y reintentar:

```bash
git worktree add --detach .local/qa1/worktree 57395f7
cd .local/qa1/worktree
vercel link --yes --project clickaton-staging --scope compramelafotos-projects
vercel deploy --prod --yes
```

Confirmar que `clickaton-staging.vercel.app` sirve un deployment cuyo commit **contiene `1b2de05`**.

### C) Email TEST (bloqueante para smoke email)

En Vercel `clickaton-staging` (Production + Preview):

1. `RESEND_API_KEY`  
2. `EMAIL_FROM` o `DNX_EMAIL_FROM` = remitente verificado Resend  
3. `CLICKATON_EMAIL_TEST_TO` = única casilla TEST controlada  

Luego smoke: un envío vía script/`sendIdentityEmail` a esa casilla.

### D) Neon CLI (opcional)

Reautenticar: `neonctl auth` (token actual 401).

### E) Auth OAuth TEST (si login Google)

Añadir redirect staging en consola Google **sin tocar** redirect productivo:

`https://clickaton-staging.vercel.app/api/auth/google/callback`  
(+ vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` si faltan en staging).

---

## Seed / Home / ficha

| Check | Estado |
|---|---|
| Seed ejecutado | **NO** (DB fail-closed) |
| `/maratones/piloto-test-11b` | **404** en alias actual |
| Home lista piloto | **NO** (pre-11B + sin seed) |

---

## Auth / Email / QR / Cron / MP

| Área | Estado |
|---|---|
| Auth secret | configurado en Vercel; login E2E **no validado** (deploy viejo) |
| Email | **BLOQUEADO** — falta Resend + TO |
| QR secret | configurado; `selfcheck:qr-token` local OK |
| Cron | secret configurado; smoke 401/200 **no ejecutado** contra deploy 11B |
| MP sandbox | tokens TEST presentes; provider `mercado_pago_test`; LIVE no tocado |

---

## Playwright readiness

Añadido en repo:

- `apps/clickaton/playwright.config.ts`  
- `apps/clickaton/e2e/env-smoke.spec.ts`  
- `apps/clickaton/e2e/helpers/test-identities.ts`  
- scripts `test:e2e*`  

Evidencias → `.local/qa1/` (gitignored).  
Suite funcional completa → **QA2**.

---

## Checklist QA2

| Recurso | Estado | Evidencia | Bloquea QA2 |
|---|---|---|---:|
| Código 11B desplegado | NO | alias en `2b66279`; CLI UNKNOWN | **sí** |
| SHA verificado | NO | — | **sí** |
| DB staging confirmada | NO | pull vacío / dawn-dew fail-closed | **sí** |
| Migraciones | NO | sin URL | **sí** |
| Seed idempotente | NO | — | **sí** |
| Home/ficha piloto | NO | 404 | **sí** |
| Auth TEST | PARCIAL | secret OK; login no smoke | **sí** |
| QR secret | SÍ (Vercel) | selfcheck local | no* |
| Cron secret | SÍ (Vercel) | sin smoke HTTP | parcial |
| Email provider | NO | — | **sí** |
| Email smoke | NO | — | **sí** |
| MP sandbox | SÍ config | provider TEST | no |
| Flags OFF | SÍ | inventario | no |
| Playwright desktop/mobile | INFRA lista | falta dep install + deploy | parcial |
| Producción aislada | SÍ | proyectos/dominios distintos | no |

\* Tras deploy 11B.

---

## Rollback

- Deploy staging: redeploy last Ready (`dpl_…ovwcammtr…` / SHA `2b66279`) en proyecto `clickaton-staging` únicamente.  
- Variables: remover las añadidas en QA1 si se desea (`AUTH_SECRET`, QR, CRON, `DNX_ENVIRONMENT`, etc.).  
- Seed: no aplicado → N/A.  
- **Nunca** tocar `clickaton-dnxsuite` / `maratonfotografica.com`.

---

## Flags

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
