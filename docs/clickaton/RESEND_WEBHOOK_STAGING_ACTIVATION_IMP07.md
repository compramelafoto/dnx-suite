# Resend Webhook — Staging Activation (Imp07)

Host temporal: Clickatón
URL: `https://clickaton-staging.vercel.app/api/webhooks/resend`
Modo único activable: `verify_only`
Opens/clicks: **bloqueados en servidor** (no persistir).

---

## Fases

| Fase | enabled | mode | HTTP |
|------|---------|------|------|
| A Preparada | false | disabled | 404 |
| B Expuesto deshabilitado | true | disabled | 503 |
| C Verify-only técnico | true | verify_only | 200/4xx/5xx |
| D Process | — | process | **NO habilitar** |

---

## Eventos permitidos (server-side)

```text
email.sent
email.delivered
email.delivery_delayed
email.bounced
email.complained
email.failed
email.suppressed
```

`email.opened` / `email.clicked` → firma OK → `ignored` + `WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT` → HTTP 200 → **sin fila comportamental**.

---

## Comandos de preparación

```bash
# 1) Tests / typecheck / lint (local)
pnpm --filter @repo/communications test
pnpm --filter @repo/communications check-types
pnpm --filter @repo/communications lint
pnpm --filter clickaton test:resend-webhook
pnpm --filter @repo/db exec prisma validate

# 2) Identidad DB + migración staging (Imp09: sin fallback a DATABASE_URL)
# DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS
# Identidad vigente: ep-round-fog / neondb (ep-divine-smoke/clickaton_staging = histórica)
export COMMUNICATIONS_STAGING_DATABASE_URL="…staging…"
export COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging
export COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog
export COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb

pnpm --filter @repo/db communications:db:identity
pnpm --filter @repo/db communications:migrate:webhook-staging
# → SKIPPED sin --confirm-staging-migration

pnpm --filter @repo/db communications:migrate:webhook-staging -- --confirm-staging-migration
# → solo si identity guard OK

# 3) Readiness (read-only)
pnpm --filter clickaton communications:webhook:readiness
```

---

## Registro manual en Resend (no automatizado)

1. Staging desplegado con vars Fase C.
2. Readiness `READY` o `READY WITH WARNINGS` (phase `C_verify_only`).
3. Dashboard Resend → Webhooks → Add endpoint.
4. URL: `https://clickaton-staging.vercel.app/api/webhooks/resend`
5. Seleccionar **solo** eventos técnicos listados arriba (sin opened/clicked).
6. Copiar signing secret → `RESEND_WEBHOOK_SECRET` en Vercel `clickaton-staging`.
7. Vars:

```env
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=true
COMMUNICATIONS_WEBHOOK_MODE=verify_only
COMMUNICATIONS_WEBHOOK_ENVIRONMENT=staging
COMMUNICATIONS_WEBHOOK_PERSIST_BEHAVIORAL_EVENTS=false
```

8. Redeploy staging si hace falta para tomar env.
9. Smoke email autorizado (`system.test`) con `--confirm-live-send`.
10. `pnpm --filter clickaton communications:webhook:recent -- --limit 10`
11. Verificar dedupe (reenviar mismo evento / retry Resend).
12. Logs Vercel sanitizados.
13. Rollback ante error.

**No** usar API admin de Resend para crear el webhook.
**No** guardar el secreto en git.

---

## Health (protegido)

```text
GET /api/internal/health/communications/resend-webhook
Authorization: Bearer <CRON_SECRET|COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN>
```

---

## ROLLBACK inmediato

```env
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false
COMMUNICATIONS_WEBHOOK_MODE=disabled
```

1. Deshabilitar endpoint en Resend.
2. Redeploy/vars si aplica.
3. Verificar HTTP 404.
4. Conservar filas en `DnxCommunicationWebhookEvent`.
5. No borrar tabla / no revertir migración destructivamente.

---

## Retención staging (propuesta)

**30 días** para eventos técnicos minimizados (IDs, status, mask, host/path seguro, códigos de fallo).
Sin borrado automático en Imp07.
Sin opens/clicks, IP, UA, body, firma, email completo.

---

## Legal

| Acción | Estado |
|--------|--------|
| Código / scripts / tests locales | `NO ACTION REQUIRED NOW` |
| Migración + recepción staging de eventos técnicos | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| Opens/clicks productivos | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## Rate limiting

`NOOP DOCUMENTED` por defecto (`COMMUNICATIONS_WEBHOOK_RATE_LIMIT_ENABLED=false`).
Opcional in-memory = **BEST EFFORT** (no durable en serverless). Autenticidad = firma Svix + unique DB.
