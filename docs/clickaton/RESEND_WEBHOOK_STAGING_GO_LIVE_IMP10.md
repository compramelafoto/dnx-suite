# Resend Webhook — Staging Go-Live (Imp10)

**Fecha:** 2026-08-01 (UTC-3)
**Implementación:** ETAPA 03 / Imp10
**Operadores:** agente Cursor + operador (Daniel)
**Estado general:** `BLOCKED`

```text
DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS
```

> **Imp10bis (2026-08-01):** aislamiento de deploys documentado en [`VERCEL_DEPLOYMENT_ISOLATION_IMP10BIS.md`](./VERCEL_DEPLOYMENT_ISOLATION_IMP10BIS.md) y [`DEPLOYMENT_TOPOLOGY.md`](./DEPLOYMENT_TOPOLOGY.md).
> El estado histórico `BLOCKED` de Imp10 se conserva. Causa: Ignored Build Step productivo incorrecto (solo saltaba `clickaton-staging`). Corregido a **solo `main`**. No reanudar migrate/Resend hasta `communications:imp10-resume-readiness` + prereqs manuales.
>
> **Imp10ter (2026-08-01):** push controlado verificado — staging git READY + producción git CANCELED. Evidencia [`CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md`](./CONTROLLED_STAGING_PUSH_VALIDATION_IMP10TER.md). Imp10 go-live (backup/migrate/Resend) sigue pendiente de prereqs manuales.
>
> **Imp10quater (2026-08-01):** activación de base staging completada — backup Neon, identity, migración webhook ya APPLIED, tabla/unique/dedupe, health token, health Communications `schema=ready`, webhook sigue disabled, Resend no configurado. Evidencia [`STAGING_DATABASE_ACTIVATION_IMP10QUATER.md`](./STAGING_DATABASE_ACTIVATION_IMP10QUATER.md). El estado histórico `BLOCKED` de Imp10 (go-live Resend) se conserva hasta legal + secret + verify_only.

---

## 1. Revalidación Vercel

| Check | Resultado |
| ----- | --------- |
| Proyecto | `clickaton-staging` |
| Dominio | `clickaton-staging.vercel.app` |
| Deployment alias | `dpl_D7fYFmTao2TixSZVLuuBKQqqnnLj` |
| Target Vercel | `production` **del proyecto staging** (no del producto real) |
| Rama (staging tip Imp09) | `migration-legacy-clf-to-monorepo` @ `22bf4ee` |
| Endpoint staging | `POST → 404 {"received":false}` (disabled) |
| Health DB staging | `ok`, host `ep-round-fog-a4xgibtv-pooler` |

```text
VERCEL TARGET IDENTITY: PASS
```

Interpretación de “Production” en staging: environment principal del proyecto `clickaton-staging`, **no** `maratonfotografica.com`.

---

## 2. Producción intacta

| Check | Resultado |
| ----- | --------- |
| Proyecto productivo | `clickaton-dnxsuite` → `maratonfotografica.com` |
| Deploy reciente prod | `dpl_85AhnatxoQzzYXJuKJ1kbqyhXjV9` — **2026-08-01 05:15** — branch `migration-legacy-clf-to-monorepo` commit `ae25ad7` |
| `POST /api/webhooks/resend` en prod | `404 {"received":false}` (ruta presente, flag off) |
| Home prod | `200` |
| Vars Communications en prod | no configuradas en esta sesión |
| Webhook Resend productivo | no creado |
| Migración prod | no ejecutada por Imp10 |

```text
PRODUCTION INTACT: BLOCKED
```

**Causa:** la misma rama Git alimenta `clickaton-staging` y `clickaton-dnxsuite`. Los pushes Imp09/posteriores provocaron deploy automático en `maratonfotografica.com` con el código del ingress (aunque `enabled=false`).

**Corte Imp10:** no se avanza a backup→migrate→Resend→smoke hasta desacoplar deploys o aceptación humana explícita del riesgo de superficie en prod.

---

## 3. Backup Neon

```text
BACKUP: BLOCKED
```

- `neonctl` ausente
- Sin API Neon en sesión
- Nombre pendiente: `backup-communications-webhook-imp10`

Comando / pasos manuales:

1. Neon dashboard → proyecto del host `ep-round-fog*`
2. Create branch `backup-communications-webhook-imp10` desde branch fuente staging
3. No conectar a Vercel
4. Registrar ID parcial + timestamp → `BACKUP: PASS`

---

## 4. URL staging

```text
COMMUNICATIONS_STAGING_DATABASE_URL: BLOCKED
```

- `vercel env pull` → `DATABASE_URL` / `DIRECT_URL` vacíos (encrypted)
- Shell sin `COMMUNICATIONS_STAGING_DATABASE_URL`
- **No** se escribió a `.env`
- **No** se usó `ep-dawn-dew`

Pendiente operador:

```bash
export COMMUNICATIONS_STAGING_DATABASE_URL='…'   # solo sesión; host ep-round-fog; db neondb
```

---

## 5. Identity / migrate / schema

| Paso | Resultado |
| ---- | --------- |
| Identity guard | no ejecutado remoto — URL ausente |
| Migrate status | `BLOCKED` |
| Migración | **NO** aplicada |
| Tabla / unique / atomic | **NO** validados en staging |

---

## 6. Corrección readiness (código local Imp10)

Aplicada en working tree / commit local pendiente de política de push:

- Modos: `staging_explicit` (default), `local`, `remote_health`
- `staging_explicit` exige `COMMUNICATIONS_STAGING_DATABASE_URL`
- **Sin fallback** a `DATABASE_URL`
- Host esperado `ep-round-fog`, DB `neondb`
- Tests readiness ampliados: **11** casos nuevos + endpoint tests → **27 PASS**

Health acepta también `COMMUNICATIONS_HEALTH_TOKEN`.

Script: `communications:migrate:status:staging` (requiere URL explícita).

---

## 7. Retención staging (documentada)

| Campo | Valor |
| ----- | ----- |
| Tabla | `DnxCommunicationWebhookEvent` |
| Datos | IDs provider, tipos, status, mask, host/path seguro, códigos fallo |
| Finalidad | verificación técnica webhook Resend en staging |
| Retención | **30 días** |
| Opens/clicks | no persistidos (bloqueados) |
| Borrado automático | no en Imp10; cleanup objetivo post go-live |
| Responsable | operador DNX Communications / Clickatón |

---

## 8. Fase B / C / Resend / smoke

| Paso | Resultado |
| ---- | --------- |
| Variables Fase B | **NO** aplicadas (corte producción) |
| Webhook Resend | `BLOCKED` — no creado |
| Signing secret | no configurado |
| Fase C verify_only | no activada |
| Revisión legal interna smoke | no solicitada (sin envío) |
| Email smoke | **NO** enviado |
| Eventos recibidos | n/a |
| Dedupe real | n/a |
| opened/clicked registros | `0` (sin tráfico) |

```text
WEBHOOK RESEND REGISTRATION: NO
EMAIL SMOKE: NO
```

---

## 9. Estado final

```text
BLOCKED
```

No se alcanzó `STAGING ACTIVE IN VERIFY_ONLY`.

Rollback readiness: `ROLLBACK READY` (endpoint staging sigue disabled / 404 JSON; no hace falta rollback adicional).

---

## 10. Legal

| Escenario | Estado |
| --------- | ------ |
| Sin recolección en Imp10 | `NO ACTION REQUIRED NOW` |
| Antes de smoke/eventos | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| opened/clicked productivos | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## 11. Acciones manuales para desbloquear Imp10bis / Imp11

1. **Desacoplar** deploy de `clickaton-dnxsuite` de `migration-legacy-clf-to-monorepo` (o pinear prod a otra rama) y confirmar `PRODUCTION INTACT: PASS`.
2. Crear backup Neon `backup-communications-webhook-imp10` → `BACKUP: PASS`.
3. Exportar en sesión `COMMUNICATIONS_STAGING_DATABASE_URL` (ep-round-fog / neondb).
4. `communications:db:identity` → PASS.
5. `communications:migrate:status:staging` → PENDING/ALREADY.
6. `communications:migrate:webhook-staging -- --confirm-staging-migration`.
7. Validar tabla + unique + atomic fixture.
8. Configurar health token staging + Fase B → 503 → webhook Resend 7 eventos → secret → Fase C → smoke único.

---

## 12. Referencias

- Imp09: [`RESEND_WEBHOOK_STAGING_RECOVERY_IMP09.md`](./RESEND_WEBHOOK_STAGING_RECOVERY_IMP09.md)
- Imp08: [`RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md`](./RESEND_WEBHOOK_STAGING_EXECUTION_IMP08.md)
- Identidades: [`../infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md)
