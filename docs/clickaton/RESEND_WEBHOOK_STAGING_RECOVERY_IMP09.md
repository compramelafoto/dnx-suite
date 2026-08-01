# Resend Webhook — Staging Environment Recovery (Imp09)

**Fecha:** 2026-08-01 (UTC-3)
**Implementación:** ETAPA 03 / Imp09
**Estado general:** `DONE WITH WARNINGS`

```text
DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS
```

> **Imp10 (2026-08-01):** go-live staging **BLOCKED**. Ver [`RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md`](./RESEND_WEBHOOK_STAGING_GO_LIVE_IMP10.md).
> Hallazgo crítico: la rama `migration-legacy-clf-to-monorepo` también desplegó `clickaton-dnxsuite` / `maratonfotografica.com` con el ingress (disabled). Migración/Resend/smoke no ejecutados. Readiness corregido para exigir `COMMUNICATIONS_STAGING_DATABASE_URL`.

---

## 1. Causa raíz (Imp08 → Imp09)

| Bloqueo Imp08 | Resolución Imp09 |
| ------------- | ---------------- |
| `.env` local → `ep-dawn-dew` (denylist) | Scripts usan solo `COMMUNICATIONS_STAGING_DATABASE_URL` (sin fallback) |
| Identidad ambigua `ep-round-fog` vs `ep-divine-smoke` | Reconciliación: **vigente** = `ep-round-fog` / `neondb` |
| Código Imp06–07 sin commit/deploy | Commit + push + deploy Production del proyecto `clickaton-staging` |
| Endpoint 404 HTML (ruta ausente) | Ruta en build; alias responde `404 {"received":false}` (flag) |
| Sin backup Neon | `BACKUP: MANUAL ACTION REQUIRED` |
| Migración no aplicada | **BLOCKED** — falta URL staging explícita + backup PASS |

---

## 2. Auditoría de fuentes de env (sin secretos)

| Fuente | Variable presente | Entorno declarado | Host sanitizado | Riesgo |
| ------ | ----------------: | ----------------- | --------------- | ------ |
| root `.env` | no (gitignore) | — | — | low |
| `packages/db/.env` | sí `DATABASE_URL` | unknown/dev | `ep-dawn-dew***` | **high** |
| `apps/clickaton/.env.local` | sí | unknown | `ep-dawn-dew***` | **high** |
| shell `DATABASE_URL` | no (sesión Imp09) | — | — | low |
| shell `COMMUNICATIONS_STAGING_DATABASE_URL` | no | — | — | — |
| Vercel `clickaton-staging` `env pull` | claves presentes; valores sensibles vacíos | production-of-staging-project | (runtime health) `ep-round-fog***` | medium |
| Health remoto | n/a | staging app | `ep-round-fog-a4xgibtv-pooler` | low (SoT runtime) |

### Precedencia efectiva

1. Runtime Vercel `clickaton-staging` (health DB).
2. `COMMUNICATIONS_STAGING_DATABASE_URL` (scripts Imp09 — único permitido para migrate).
3. `.env` / `.env.local` locales — **peligrosos; no usar para migrate**.

**Confirmación:** no se ejecutó migrate con el `.env` peligroso. El guard aborta sin `COMMUNICATIONS_STAGING_DATABASE_URL`.

---

## 3. Identidad staging

```text
STAGING DATABASE IDENTITY: RESOLVED
```

| Campo | Valor |
| ----- | ----- |
| Host esperado | `ep-round-fog` (prefijo) |
| Database esperada | `neondb` |
| Proyecto Vercel | `clickaton-staging` |
| `ep-dawn-dew` | **DO NOT USE FOR STAGING** |
| `ep-divine-smoke` / `clickaton_staging` | **histórica** (10B1 / 10D3I) |

**Fuente de verdad:** health efectivo Vercel staging > docs históricas.

Ver [`docs/infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md).

---

## 4. Backup

```text
BACKUP: MANUAL ACTION REQUIRED
```

Pasos Neon (dashboard):

1. Proyecto Neon del host `ep-round-fog*` (conectado a `clickaton-staging`).
2. Branches → Create branch `backup-communications-webhook-imp09`.
3. No conectar el branch a Vercel.
4. Conservar ≥ 7 días.
5. Aceptar riesgo humano explícito **o** `BACKUP: PASS` antes de migrate.

---

## 5. Git

| Campo | Valor |
| ----- | ----- |
| Rama | `migration-legacy-clf-to-monorepo` |
| Remoto | `origin` → `compramelafoto/dnx-suite` |
| Commit principal | `846bbae` — `feat(communications): add resend webhook staging ingress` |
| Follow-ups lockfile | `aa52dd6`, `22bf4ee` (deploy tip) |
| Push | PASS (sin `--force`) |
| Hooks | commit creado OK |
| `UNRELATED_WORKTREE_CHANGES` | sí — excluidos del commit (CLF, rules-2026, payments WIP, etc.) |

---

## 6. Deploy staging

| Campo | Valor |
| ----- | ----- |
| Proyecto | `clickaton-staging` |
| Deployment Production | `dpl_D7fYFmTao2TixSZVLuuBKQqqnnLj` |
| Preview Ready (mismo commit) | `dpl_9H71V9fZXctY3SJBBXgjAiivU3GB` |
| Commit | `22bf4ee` |
| Build | PASS — ruta `ƒ /api/webhooks/resend` en Route (app) |
| Alias | `https://clickaton-staging.vercel.app` |
| Endpoint POST | `404` body `{"received":false}` (feature flag / disabled) |
| Antes Imp08 | `404` HTML (ruta ausente) |

### Variables staging configuradas (Production del proyecto staging)

| Variable | Valor |
| -------- | ----- |
| `COMMUNICATIONS_RESEND_WEBHOOK_ENABLED` | `false` |
| `COMMUNICATIONS_WEBHOOK_MODE` | `disabled` |
| `COMMUNICATIONS_EXPECTED_DATABASE_ENV` | `staging` |
| `COMMUNICATIONS_EXPECTED_DATABASE_NAME` | `neondb` |
| `COMMUNICATIONS_EXPECTED_HOST_PREFIX` | `ep-round-fog` |
| `RESEND_WEBHOOK_SECRET` | **no** configurado (Imp10) |

Producción `maratonfotografica.com` / proyecto prod: **intacta** (home `200`; webhook HTML 404; sin vars Communications productivas tocadas).

---

## 7. Migración

```text
MIGRATION: BLOCKED
```

Motivos:

1. `BACKUP` no PASS.
2. `vercel env pull` no entregó `DATABASE_URL` (valores sensibles vacíos).
3. Sin `COMMUNICATIONS_STAGING_DATABASE_URL` en sesión.
4. Guard correcto: sin fallback a `DATABASE_URL`.

Comando cuando el operador provea URL + backup:

```bash
COMMUNICATIONS_STAGING_DATABASE_URL="…" \
COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging \
COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog \
COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb \
pnpm --filter @repo/db communications:db:identity

COMMUNICATIONS_STAGING_DATABASE_URL="…" \
COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging \
COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog \
COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb \
pnpm --filter @repo/db communications:migrate:webhook-staging -- --confirm-staging-migration
```

---

## 8. Health / readiness

| Check | Resultado |
| ----- | --------- |
| Health DB remoto | `ok=true`, host `ep-round-fog-a4xgibtv-pooler` |
| Health Communications remoto | `401` sin token (`COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN` no configurado) |
| Readiness local | **no confiable** — usa `.env` denylist; identity `production_blocked` |
| Endpoint staging | desplegado, disabled |

**Nota de riesgo:** el readiness local (vía Prisma + `.env`) reportó existencia de tabla `DnxCommunicationWebhookEvent` en el host denylist. Imp09 **no** aplicó migrate. Investigar en Imp10 sin usar ese host para staging.

---

## 9. Legal

| Escenario | Estado |
| --------- | ------ |
| Esta implementación | `NO ACTION REQUIRED NOW` |
| Antes de registrar webhook / datos staging | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| Opens/clicks productivos | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

```text
WEBHOOK RESEND REGISTRATION: NO
EMAIL SMOKE: NO
```

---

## 10. Estado final Imp09

```text
STAGING CODE DEPLOYED — WEBHOOK DISABLED — SCHEMA PENDING
```

(No `SCHEMA READY` hasta migrate staging con URL explícita + backup.)

---

## 11. Pendientes Imp10

1. Backup Neon `backup-communications-webhook-imp09` → `BACKUP: PASS`.
2. Proveer `COMMUNICATIONS_STAGING_DATABASE_URL` (host `ep-round-fog`, DB `neondb`) sin pegar en git.
3. Identity PASS + migrate + table/unique/atomic smoke.
4. `COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN` + health Communications.
5. Registrar webhook Resend (7 eventos técnicos) + secret.
6. Smoke `verify_only` con review legal staging.
7. No opened/clicked / `process`.
8. Auditar si la tabla existe indebidamente en `ep-dawn-dew` (solo inspección autorizada).

---

## 12. Referencias

- Evidencia bloqueada Imp08: [`RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md`](./RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md)
- Prep: [`RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md`](./RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md)
- Identidades: [`../infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md)
