# Staging Database Activation — Imp10quater

**Fecha:** 2026-08-01 (UTC-3)  
**Implementación:** ETAPA 03 / Imp10quater  
**Estado general:** `DONE WITH WARNINGS`

```text
DEPLOYMENT FREEZE: ACTIVE (durante la operación)
STAGING DATABASE READY
WEBHOOK CODE DEPLOYED
WEBHOOK DISABLED
RESEND NOT CONFIGURED
```

---

## 1. Aislamiento revalidado

| Check | Resultado |
| ----- | --------- |
| Proyecto staging | `clickaton-staging` (`prj_MM6Bkdi8***`) |
| Alias staging | `clickaton-staging.vercel.app` → `dpl_GwQNDYMSxkq863j9r14GaFjGuJcg` (redeploy env) |
| Dominio productivo | `maratonfotografica.com` → `dpl_6MYh99deC9M1yupSSa7FV5u15kPw` (deploy de `main` ajeno a esta Imp) |
| WIP en prod (git) | deployments Preview **CANCELED** (Ignored Build Step) |
| Root `.vercel` | sigue apuntando a `clickaton-dnxsuite` — no usar para deploy |
| `apps/clickaton/.vercel` | `clickaton-staging` |
| `deployment:identity` | PASS |

```text
DEPLOYMENT ISOLATION: PASS
```

Advertencia: el alias productivo avanzó por commits en `main` (fuera del freeze de Communications). No fue promovido desde WIP. Vars Communications productivas: ausentes.

---

## 2. Acceso Neon

| Recurso | Acceso | Permiso |
| ------- | -----: | ------- |
| Proyecto staging lógico | sí | read |
| Branch staging (primary) | sí | read |
| Backup branch | sí | create (ya existía ready) |
| Connection string | sí | read (sesión, en memoria) |
| Migration | sí | execute (no reaplicada: ya APPLIED) |

CLI: `neonctl` con `--org-id` org Dnx (`org-bold-morning-***`).

---

## 3. Identidad Neon staging

| Campo | Valor sanitizado |
| ----- | ---------------- |
| `NEON_PROJECT_ID` | `fragrant-union-80829821` |
| `NEON_PROJECT_NAME` | `dnx-suite-staging` |
| `NEON_SOURCE_BRANCH_ID` | `br-noisy-flower-a4***` |
| `NEON_SOURCE_BRANCH_NAME` | `production` (nombre Neon; entorno lógico = staging) |
| `NEON_DATABASE_NAME` | `neondb` |
| `NEON_HOST_MASKED` | `ep-round-fog***` |

Distinción explícita:

```text
Vercel project = clickaton-staging
Neon project   = dnx-suite-staging
Neon database  = neondb
logical env    = staging
```

Histórico no usado: Neon project `clickaton-staging` / host `ep-divine-smoke***`.  
Denylist: `ep-dawn-dew***`.

```text
NEON STAGING IDENTITY: PASS
```

---

## 4. Backup

| Campo | Valor |
| ----- | ----- |
| Nombre | `backup-communications-webhook-imp10quater` |
| ID parcial | `br-billowing-band-***` |
| Source parcial | `br-noisy-flower-a4***` |
| createdAt | `2026-08-01T09:07:16` |
| estado | `ready` |
| Proyecto | `dnx-suite-staging` (no producción) |
| Conectado a app | no |

```text
BACKUP: PASS
```

---

## 5. Connection string

| Check | Resultado |
| ----- | --------- |
| Obtenida | YES (Neon CLI → memoria de sesión) |
| Variable | `COMMUNICATIONS_STAGING_DATABASE_URL` |
| Host masked | `ep-round-fog***` |
| Database | `neondb` |
| Escrita en `.env` | NO |
| Fallback `DATABASE_URL` / `DIRECT_URL` | NO |

---

## 6. Identity guard

```text
DATABASE IDENTITY: PASS
```

Host validado `ep-round-fog***`, database `neondb`, denylist no hit, conexión efectiva, sin fallback.

---

## 7. Readiness previo / migrate status

| Paso | Resultado |
| ---- | --------- |
| Readiness CLI `staging_explicit` | tooling WARN: ping Prisma en app Clickatón falla por resolución `@prisma/client` local; identity + SQL directos OK |
| Migrate status | target `20260801120000_dnx_communication_webhook_events`: **ALREADY_APPLIED** |
| Otras migraciones pendientes | sí (fuera de alcance Imp10quater) — **no** se ejecutó `migrate deploy` |

---

## 8. Revisión SQL

Migración aditiva: enum + tabla + índices. Unique `(provider, providerEventId)`. Sin DROP/ALTER destructivo, sin seed.

```text
MIGRATION REVIEW: PASS
```

---

## 9. Migración

| Campo | Valor |
| ----- | ----- |
| Aplicada en esta sesión | NO (ya estaba APPLIED) |
| Nombre | `20260801120000_dnx_communication_webhook_events` |
| Entorno | staging (`ep-round-fog***` / `neondb`) |
| Resultado | PASS (tabla + fila `_prisma_migrations` finished) |
| `migrate deploy` masivo | **omitido a propósito** (hubiera aplicado 6 migraciones ajenas) |

```text
MIGRATION: PASS (already applied; deploy skipped)
```

---

## 10. Validación tabla / unique / dedupe

| Check | Resultado |
| ----- | --------- |
| Tabla | `DnxCommunicationWebhookEvent` EXISTS |
| Columnas | id, provider, providerEventId, providerMessageId, rawEventType, normalizedEventType, status, occurredAt, receivedAt, processedAt, recipientMasked, recipientHash, safeLinkHost, safeLinkPath, failureCategory, failureReasonCode, processingAttempts, lastErrorCode, productEffectsEnabled, createdAt, updatedAt |
| Unique | `DnxCommunicationWebhookEvent_provider_providerEventId_key` UNIQUE `(provider, providerEventId)` |
| Atomic dedupe 1º | `accepted` (`reserved`) |
| Atomic dedupe 2º | `duplicate` |
| Fixture | limpiado (`evt_imp10quater_fixture`) |

---

## 11. Variables staging (sin valores)

Proyecto: `clickaton-staging`.

**Production** (consume el alias `clickaton-staging.vercel.app`):

- `COMMUNICATIONS_RESEND_WEBHOOK_ENABLED`
- `COMMUNICATIONS_WEBHOOK_MODE`
- `COMMUNICATIONS_EXPECTED_DATABASE_ENV`
- `COMMUNICATIONS_EXPECTED_DATABASE_HOST`
- `COMMUNICATIONS_EXPECTED_HOST_PREFIX`
- `COMMUNICATIONS_EXPECTED_DATABASE_NAME`
- `COMMUNICATIONS_WEBHOOK_MAX_BYTES`
- `COMMUNICATIONS_WEBHOOK_RATE_LIMIT_ENABLED`
- `COMMUNICATIONS_WEBHOOK_ALERTS_ENABLED`
- `COMMUNICATIONS_HEALTH_TOKEN`

**Preview** (branch `migration-legacy-clf-to-monorepo`): set equivalente (incl. health token).

**No configurado:** `RESEND_WEBHOOK_SECRET`, `COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS` (defaults técnicos en código).

Proyecto productivo `clickaton-dnxsuite`: **sin** vars Communications.

---

## 12. Redeploy por variables

| Campo | Valor |
| ----- | ----- |
| Método | `vercel redeploy` del dpl staging previo (sin upload de código sucio) |
| Identity previa | PASS |
| Deployment ID | `dpl_GwQNDYMSxkq863j9r14GaFjGuJcg` |
| Alias | `clickaton-staging.vercel.app` |

---

## 13. Health / endpoint

| Probe | Resultado |
| ----- | --------- |
| `POST /api/webhooks/resend` | `404 {"received":false}` |
| `/api/public/health/db` | `ok=true`, host `ep-round-fog-a4xgibtv-pooler` |
| Health Communications sin token | `401` |
| Health Communications token inválido | `401` |
| Health Communications token válido | `ok=true`, `enabled=false`, `mode=disabled`, `database=reachable`, `schema=ready`, `productEffectsEnabled=false` |
| Readiness `remote_health` | `READY WITH WARNINGS` (webhook disabled / secret absent / no receiving) |

Interpretación operativa:

```text
READY FOR RESEND CONFIGURATION
```

---

## 14. Producción intacta (Communications)

| Check | Resultado |
| ----- | --------- |
| Migración prod por Imp10quater | no |
| Vars Communications prod | ausentes |
| Webhook Resend | no creado |
| Signing secret | no |
| Emails | no |
| Webhook HTTP prod | `404 {"received":false}` |
| Home prod | 200 |

```text
PRODUCTION INTACT: PASS
```

Nota: el dpl vivo de `maratonfotografica.com` cambió por deploy de `main` ajeno; no por esta Imp.

---

## 15. Retención

```text
retención propuesta: 30 días
estado: documentada, cleanup pendiente
fecha objetivo cleanup: 2026-08-31 (implementación futura; sin cron ahora)
```

---

## 16. Legal

| Escenario | Estado |
| --------- | ------ |
| Backup + migrate validación + health sin tráfico | `NO ACTION REQUIRED NOW` |
| Antes de registrar webhook / recolectar eventos staging | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| opened/clicked producción | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## 17. Deuda / riesgos

1. CLI readiness `staging_explicit` no puede instanciar Prisma desde `apps/clickaton` (resolución `@prisma/client`); validar schema vía `@repo/db` o health remoto.
2. Script `communications:migrate:webhook-staging` ejecuta `prisma migrate deploy` completo — peligroso con migraciones ajenas pendientes; hace falta filtro por migración o gate.
3. Primary Neon branch se llama `production` dentro del proyecto staging — riesgo de confusión nominal.
4. Root `.vercel` → prod; CLI puede bypassear Ignored Build Step.
5. Health token Preview vs Production pueden diferir (ambos configurados).

---

## 18. Pendientes para Resend (siguiente Imp)

1. Legal review recomendada antes de recolección staging.
2. Crear webhook Resend (7 eventos técnicos; sin opened/clicked productivos).
3. Configurar `RESEND_WEBHOOK_SECRET` solo staging.
4. Habilitar `verify_only` (no `process`).
5. Un smoke email controlado.
6. No tocar producción.

---

## Referencias

- Imp10: [`RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md`](./RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md)
- Imp10ter: [`CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md`](./CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md)
- Imp10bis: [`VERCEL_DEPLOYMENT_ISOLATION_IMP10BIS.md`](./VERCEL_DEPLOYMENT_ISOLATION_IMP10BIS.md)
- Identidades DB: [`../infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md)
