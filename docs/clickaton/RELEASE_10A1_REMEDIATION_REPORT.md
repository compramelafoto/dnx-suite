# RELEASE 10A.1 — Informe de remediación

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Sin:** commit / push / deploy prod / migraciones prod / cobros LIVE / apertura inscripciones

## Veredicto

**READY FOR ETAPA 10B WITH WARNINGS**

Los bloqueos técnicos de código listados en 10A fueron remediados. Persisten warnings operativos (DB remota, secrets Vercel, OAuth flags OFF, decisión producto owner vs Tammy).

---

## Por bloqueo

### 1. `CALLBACK_SERVICE_PENDING_RUNTIME_BINDING`

| | |
|--|--|
| **Antes** | Callback HTTP stub |
| **Corrección** | `createOwnerOAuthRuntime` + `connect`/`callback`/`revoke`/`reconnect` llaman `ClickatonOwnerOAuthService`; redirect seguro; errores sanitizados; replay idempotente |
| **Evidencia** | `apps/clickaton/lib/admin/mp-owner-oauth/runtime.ts`, routes connect/callback/revoke/reconnect |
| **Tests** | `@repo/payments` owner-oauth 221 pass (replay + cuenta global + sanitize) |
| **Riesgo residual** | Flags OFF + secrets ausentes → no hay OAuth LIVE hasta ops 10B |
| **Estado** | **READY** (código) |

### 2. Exchange / vault / cuenta global

| | |
|--|--|
| **Antes** | Dominio listo, HTTP no |
| **Corrección** | `MercadoPagoOAuthService.exchangeAuthorizationCode` + fake client; vault Prisma; `DnxPaymentAccount` vía FI |
| **Tests** | tokens no en resultado UI; account FI-linked |
| **Estado** | **READY** (código) |

### 3. Migración welcome_cards

| | |
|--|--|
| **Antes** | Cast mapeaba desconocidos → PENDING |
| **Corrección** | Preflight abort + cast solo valores conocidos; script `preflight:welcome-cards-migration` |
| **Riesgo residual** | Validar en DB real antes de deploy |
| **Estado** | **READY WITH WARNING** |

### 4. Migración FotoRank P0-06

| | |
|--|--|
| **Antes** | DROP `bucket`/`byteSize` |
| **Corrección** | Expand + backfill; DROP diferido — `RELEASE_10A1_FOTORANK_P006_MIGRATION.md` |
| **Estado** | **READY WITH WARNING** (contract futuro) |

### 5. Email idempotente

| | |
|--|--|
| **Antes** | Send directo; webhook+S2S podían duplicar |
| **Corrección** | `EmailQueue` + `idempotencyKey` `registrationId:CLICKATON_PAYMENT_CONFIRMATION:v1`; template con nº/IG/talle/pago/link |
| **Tests** | `selfcheck:email-idempotency` OK |
| **Riesgo residual** | Requiere DB para outbox; Resend secret ops |
| **Estado** | **READY** (código) |

### 6. Reconciliación durable

| | |
|--|--|
| **Antes** | Solo on-demand |
| **Corrección** | `/api/cron/payments-reconciliation` `*/10` + batch + audits |
| **Estado** | **READY** (código; cron secreto en Vercel pendiente) |

### 7. Variables

| | |
|--|--|
| **Corrección** | check-env: `RESEND_API_KEY`, `EMAIL_FROM`, `DNX_SOCIAL_PUBLISHER_LIVE` (LIVE=true → block); `.env.example` |
| **Estado** | **READY** (validador); carga en Vercel = ops 10B |

### 8. Panel diagnóstico

| | |
|--|--|
| **Corrección** | `/admin/integraciones/diagnostico` |
| **Estado** | **READY** |

---

## Tests ejecutados

| Suite | Resultado |
|-------|-----------|
| `@repo/payments test` | **221 pass** |
| `selfcheck:email-idempotency` | **OK** |
| `clickaton:release:check-env` (local) | **OK** (0 blocks) |
| `clickaton check-types` | **FAIL preexistente** `AccreditationScanner.tsx` TS1005 |
| `@repo/payments check-types` | **FAIL preexistente** (extensiones .js / any) |
| migrate from zero | **NO** (Docker/Neon ausentes) |

---

## WIP ajeno

No tocado: Infospot, editorial-intelligence, recommendations.

---

## Recomendación 10B

1. Cargar secrets staging (Google, Resend, vault, MP app) sin pegarlos en chat.  
2. DB alcanzable → `migrate deploy` + preflight welcome + seed AR 2026.  
3. Reparar deploy staging.  
4. Primer login Tammy + grants.  
5. Ventana OAuth controlada (flags) — decidir owner exclusivo vs Tammy collector.  
6. Mantener `DNX_SOCIAL_PUBLISHER_LIVE=false`, `registrationEnabled=false`.  
7. No prod migrate/cobros hasta GO explícito.
