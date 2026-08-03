# Clickatón — Runbook staging placas participante (P0-09 / P0-10)

**Fecha:** 2026-08-03  
**Etapa:** 10 — Cierre técnico staging (continuación de 09)  
**Legal:** ver [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md) — **no habilitar público** hasta aprobación de consentimientos.

**Estado P0-11:** `BLOCKED` — ver [`clickaton-participant-cards-staging-readiness.md`](./clickaton-participant-cards-staging-readiness.md).  
**Commit código placas:** `36bac69` (`feat(clickaton): persist participant cards and add remote render worker`) — push diferido.

---

## Preflight checklist

| ITEM | ESTADO | VALOR ESPERADO | VALIDACIÓN | BLOQUEO |
|------|--------|----------------|------------|---------|
| App staging | OK | `clickaton-staging` | Vercel project + alias `clickaton-staging.vercel.app` | — |
| Runtime | OK | Vercel Next.js | Sin Chromium en serverless | Provider `remote` o worker local |
| Neon staging | OK | `dnx-suite-staging` / `ep-round-fog…` / `neondb` | Denylist `ep-dawn-dew` | No usar `.env.local` dawn-dew |
| Branch/commit local | OK | `main` @ `3dfbfa7` (sesión) | `git rev-parse` | Código placas puede no estar desplegado aún |
| Bucket R2 staging | BLOCKED | privado `clickaton-staging` + prefijo `clickaton-staging/participant-cards/` | MCP catalog no tiene platform `clickaton` | Credenciales R2 + catalog |
| Vars feature flags | PENDING | ver § Flags | Vercel Preview/Production staging | No activar en prod pública |
| Credenciales E2E | PENDING | fixtures `E2E_CLICKATON_CARDS_*` | script setup | Requiere `DATABASE_URL` round-fog |
| Renderer | IMPLEMENTED | Opción A/B worker Node+Playwright | `@repo/template-render-worker` | Deploy 24/7 pendiente |
| Dominio staging | OK | `https://clickaton-staging.vercel.app` | HTTP | — |
| Migración placas | APPLIED | `20260801140000_clickaton_participant_cards` | tabla + índices + FKs + enum | — |
| Prisma client | OK | 6.19.x | `prisma generate` | — |
| Chromium | LOCAL OK | Playwright en worker | healthcheck browserAvailable | No en Vercel function |

---

## Identidad de base (obligatorio)

```text
Vercel project = clickaton-staging
Neon project   = dnx-suite-staging (fragrant-union-80829821)
Host           = ep-round-fog***
Database       = neondb
DENYLIST       = ep-dawn-dew***
```

Variable de sesión recomendada: `COMMUNICATIONS_STAGING_DATABASE_URL` o `DATABASE_URL` apuntando **solo** a round-fog.  
**No** usar `apps/clickaton/.env.local` / `packages/db/.env` si apuntan a dawn-dew.

---

## Backup (pre-migración P0-09)

| Campo | Valor |
|-------|-------|
| Nombre | `backup-before-participant-cards-p009-20260801` |
| Branch id | `br-lively-credit-a4r0fjj7` |
| Proyecto | `dnx-suite-staging` |
| Parent | `br-noisy-flower-a4ovb3yc` (logical staging primary) |
| Timestamp | `2026-08-01T11:18:46Z` |
| Migration | `20260801140000_clickaton_participant_cards` |

---

## Migración staging

Aplicada **solo** en `ep-round-fog` (no producción, no dawn-dew).

Validado:

- tabla `ClickatonParticipantCard`
- unique `(registrationId, cardType, renderHash)`
- índices status/lock/hash/asset
- FKs registration CASCADE / edition RESTRICT
- enum `PARTICIPANT_CARD_PNG`
- smoke insert/delete controlado OK

SQL residual idempotente (si enums ya existían):  
`packages/db/prisma/migrations/20260801140000_clickaton_participant_cards/apply-idempotent-staging.sql`

Probe:

```bash
DATABASE_URL=<round-fog> pnpm --filter clickaton exec tsx \
  scripts/ops-p009-probe-participant-cards-migration.ts
```

---

## Decisión de provider de render

| Opción | Evaluación |
|--------|------------|
| A — Worker local/container 24/7 | **Elegida para staging** |
| B — Servicio separado | Implementado como `services/template-render-worker` |
| C — Chromium serverless | **Descartada** sin pruebas de bundle/memoria; Vercel sin Chromium → 503 |

Clickatón en Vercel debe usar:

```text
CLICKATON_CARD_RENDER_PROVIDER=remote
CLICKATON_CARD_REMOTE_RENDER_URL=https://<worker>/internal/template-render
DNX_TEMPLATE_RENDER_HMAC_SECRET=<vault>
```

Doc worker: [`../template-engine/template-render-worker.md`](../template-engine/template-render-worker.md)

---

## R2 staging

Estado: **BLOCKED** en esta sesión (MCP: plataforma `clickaton` ausente del catalog; bucket no verificado).

Plan operativo:

1. Crear/validar bucket privado `clickaton-staging` (nunca prod).
2. Credenciales S3 limitadas al bucket.
3. Prefijo keys: `CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX=clickaton-staging/participant-cards`
4. Smoke:

```bash
CLICKATON_PARTICIPANT_CARDS_R2_SMOKE=1 \
  R2_BUCKET=… R2_ENDPOINT=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
  pnpm --filter clickaton exec tsx scripts/ops-p009-r2-participant-cards-smoke.ts
```

Metadata permitida: `card-type`, `template-key`, `template-version`, `render-hash-prefix`, dimensiones, `generated-at`. **Sin PII.**

---

## Feature flags (staging)

| Variable | Staging sugerido | Producción pública |
|----------|------------------|--------------------|
| `CLICKATON_PARTICIPANT_CARDS_V2_ENABLED` | `true` solo QA | `false` hasta legal |
| `CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED` | `true` | `false` por defecto |
| `CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED` | `true` | `false` |
| `CLICKATON_CARD_RENDER_PROVIDER` | `remote` | `unavailable` |
| `CLICKATON_CARD_REMOTE_RENDER_URL` | URL worker | vacío |
| `CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX` | `clickaton-staging/participant-cards` | `clickaton/participant-cards` |

UX: V2 ON → `ParticipantCardsSection`; V2 OFF → legacy `WelcomeCardShareCard`. No ambos.

---

## Fixtures E2E

```bash
CLICKATON_E2E_PARTICIPANT_CARDS_SETUP=1 DATABASE_URL=<round-fog> \
  pnpm --filter clickaton e2e:clickaton-participant-cards:setup

CLICKATON_E2E_PARTICIPANT_CARDS_CLEANUP=1 DATABASE_URL=<round-fog> \
  pnpm --filter clickaton e2e:clickaton-participant-cards:cleanup
```

Prefijo duro: `E2E_CLICKATON_CARDS_`. Credenciales en `.local/clickaton-participant-cards-e2e/` (gitignored).

---

## Timeouts / retries / circuit

| Parámetro | Valor |
|-----------|-------|
| Connect | 3s |
| Request total | 25s |
| Render (worker) | ~15s budget |
| Retries | 2 (solo 502/503/504/timeout/conexión) |
| Circuit | OPEN tras 5 fallos; HALF_OPEN 30s |
| Idempotency key | estable entre retries |

---

## No hacer

- Migrar producción
- Activar generación automática por pago
- Publicar Instagram / Meta
- Convertir R2 en público
- Declarar staging verde con E2E skipped
- Habilitar flags V2 al público sin cierre legal
