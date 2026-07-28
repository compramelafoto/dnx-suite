# RELEASE 10A.1 — Plan de remediación pre-go-live

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Reglas:** sin commit/push/deploy prod; sin migraciones prod; sin cobros LIVE; sin abrir inscripciones; sin WIP Infospot.

## Preflight

| Ítem | Valor |
|------|--------|
| HEAD | `aa92de8` (working tree dirty ~287 paths) |
| Docker | ausente |
| Neon | historically P1001 |
| WIP ajeno | Infospot / editorial / recommendations — **no tocar** |

---

## Bloqueos

| # | Bloqueo | Causa | Archivos | Solución | Pruebas | Riesgo | Estado |
|---|---------|-------|----------|----------|---------|--------|--------|
| 1 | `CALLBACK_SERVICE_PENDING_RUNTIME_BINDING` | HTTP stub; dominio listo | `connect/route.ts`, `callback/route.ts`, owner-oauth runtime | Binding Prisma+vault+`ClickatonOwnerOAuthService` | owner-oauth tests + HTTP mapping | Bajo (flags OFF por defecto) | **Hecho** |
| 2 | welcome_cards cast enum | `USING` mapea desconocidos → PENDING | `20260728080000_…/migration.sql` | Preflight abort + map solo conocidos | script preflight + SQL | Medio (mig no aplicada prod) | **Hecho** |
| 3 | FR P0-06 DROP/rewrite | DROP `bucket`/`byteSize` | `20260728140000_…` | Expand+backfill; DROP diferido | doc + SQL seguro | Alto residual hasta contract | **Hecho** |
| 4 | Email sin idempotencia | send directo en notify | `notify-registration-lifecycle`, EmailQueue | Outbox `EmailQueue` + unique key | unit/selfcheck | Bajo | **Hecho** |
| 5 | Reconcile sin cron | solo on-demand | `reconcile-registration-payment`, vercel.json | `/api/cron/payments-reconciliation` | auth + batch | Bajo | **Hecho** |
| 6 | Vars Resend/Social | check-env incompleto | `release-check-env.ts`, `.env.example` | Validar presencia/formato/defaults seguros | check-env | Bajo | **Hecho** |

---

## Orden de trabajo

1. OAuth runtime binding + idempotencia callback  
2. Migraciones seguras + docs FR P0-06  
3. Email outbox + template fields  
4. Cron reconcile  
5. Env + panel diagnóstico  
6. Tests / typecheck / reports  
