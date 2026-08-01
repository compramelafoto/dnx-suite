# Resend Webhook — Staging Environment Recovery (Imp09)

**Fecha:** 2026-08-01 (UTC-3)
**Implementación:** ETAPA 03 / Imp09
**Estado general:** ver sección final (actualizado al cerrar la sesión)

```text
DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS
```

---

## 1. Causa raíz (Imp08 → Imp09)

| Bloqueo Imp08 | Resolución Imp09 |
| ------------- | ---------------- |
| `.env` local → `ep-dawn-dew` (denylist) | Scripts usan solo `COMMUNICATIONS_STAGING_DATABASE_URL` (sin fallback) |
| Identidad ambigua `ep-round-fog` vs `ep-divine-smoke` | Reconciliación: **vigente** = `ep-round-fog` / `neondb` |
| Código Imp06–07 sin commit/deploy | Commit + push focalizado autorizado |
| Endpoint 404 (ruta ausente) | Deploy staging del host Clickatón |
| Sin backup Neon | Branch/restore point o `BACKUP: MANUAL ACTION REQUIRED` |
| Migración no aplicada | Solo tras identity PASS + backup + URL explícita |

---

## 2. Auditoría de fuentes de env (sin secretos)

| Fuente | Variable presente | Entorno declarado | Host sanitizado | Riesgo |
| ------ | ----------------: | ----------------- | --------------- | ------ |
| root `.env` | no (gitignore) | — | — | low |
| `packages/db/.env` | sí `DATABASE_URL` | unknown/dev | `ep-dawn-dew***` | **high** |
| `apps/clickaton/.env.local` | sí | unknown | `ep-dawn-dew***` | **high** |
| shell `DATABASE_URL` | no (sesión Imp09) | — | — | low |
| shell `COMMUNICATIONS_STAGING_DATABASE_URL` | no | — | — | — |
| Vercel `clickaton-staging` pull | claves presentes; valores sensibles vacíos en pull | production-of-staging-project | (runtime health) `ep-round-fog***` | medium (pull no expone secret) |
| Health remoto | n/a | staging app | `ep-round-fog-a4xgibtv-pooler` | low (fuente de verdad runtime) |

### Precedencia efectiva

1. Variables de proceso del runtime Vercel (no legibles vía `env pull` en esta sesión — valores `""`).
2. Health DB remoto de `clickaton-staging.vercel.app`.
3. `COMMUNICATIONS_STAGING_DATABASE_URL` (explícita, scripts Imp09).
4. `.env` / `.env.local` locales — **peligrosos; no usar para migrate**.

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
| `ep-dawn-dew` | **DO NOT USE FOR STAGING** (productiva / denylist) |
| `ep-divine-smoke` / `clickaton_staging` | **histórica** (10B1 / 10D3I) |

**Fuente de verdad:** health efectivo Vercel staging > docs históricas.

Ver [`docs/infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md).

---

## 4. Backup

```text
BACKUP: MANUAL ACTION REQUIRED
```

Pasos Neon (dashboard):

1. Proyecto Neon del host `ep-round-fog*` (el conectado a `clickaton-staging`).
2. Branches → Create branch `backup-communications-webhook-imp09`.
3. No conectar el branch a Vercel.
4. Conservar ≥ 7 días.
5. Registrar ID sanitizado aquí tras creación.

Migración remota **no** debe aplicarse hasta `BACKUP: PASS` o aceptación humana explícita del riesgo.

---

## 5. Git / deploy / migrate

*(Completar con hashes y IDs al cerrar Imp09.)*

| Paso | Resultado |
| ---- | --------- |
| Working tree audit | Imp06–09 vs `UNRELATED_WORKTREE_CHANGES` |
| Commit | `feat(communications): add resend webhook staging ingress` |
| Push | sin `--force` |
| Deploy | solo `clickaton-staging` |
| Vars mínimas | `COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false`, `COMMUNICATIONS_WEBHOOK_MODE=disabled` |
| Migración | solo con `COMMUNICATIONS_STAGING_DATABASE_URL` |
| Webhook Resend | **NO** registrado |
| Email smoke | **NO** enviado |
| Producción | intacta |

---

## 6. Estado legal

| Escenario | Estado |
| --------- | ------ |
| Esta implementación (sin recolección) | `NO ACTION REQUIRED NOW` |
| Antes de registrar webhook / datos staging | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| Opens/clicks productivos | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## 7. Pendientes Imp10

1. Backup Neon confirmado (`BACKUP: PASS`).
2. `COMMUNICATIONS_STAGING_DATABASE_URL` operativa + migrate.
3. Registrar webhook Resend (7 eventos técnicos).
4. `RESEND_WEBHOOK_SECRET` en Vercel staging.
5. Smoke email + `verify_only` (con review legal staging).
6. No habilitar opened/clicked / `process`.

---

## 8. Referencias

- Evidencia bloqueada: [`RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md`](./RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md)
- Prep activación: [`RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md`](./RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md)
- Identidades DB: [`../infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md)
