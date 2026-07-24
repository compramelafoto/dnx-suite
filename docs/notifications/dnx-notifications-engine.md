# DNX Notifications Engine — Etapas 18–20

## Estado operativo (Etapa 20)

Flujo punta a punta:

```text
Convocatoria CLF abierta
  → Preview audiencia (canNotify) con distribución + warnings
    → Confirmación → DnxNotificationCampaign + Delivery PENDING
    → Worker (CLI / cron / «Procesar ahora») → IN_APP / EMAIL
    → Panel /admin/notificaciones (métricas, cancel, retry, reconcile)
    → /n/[token] registra clic + cookie atribución
    → Join CLF atribuye postulación
    → Métricas reconciliables
```

Informe QA Etapa 20: `docs/notifications/notifications-etapa-20-qa-report.md`.  
Informe QA Etapa 21 (browser): `docs/notifications/notifications-etapa-21-browser-qa-report.md`.

### Browser / E2E (Etapa 21)

```bash
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-prepare-browser
# InfoSpot :3004 + CLF :3002 con la misma DATABASE_URL
pnpm --filter infospot test:e2e:notifications
pnpm --filter infospot notifications:browser-smoke
CRON_SECRET=… BASE_URL=http://127.0.0.1:3004 pnpm --filter infospot notifications:cron-auth-check
```

Storage states y password QA viven en `apps/infospot/.qa-artifacts/` (gitignored).

## Migración

- Archivo: `packages/db/prisma/migrations/20260723180000_dnx_notifications_engine_etapa18/`
- **No** usar `prisma migrate deploy` completo en `ep-dawn-dew` (host ambiguo staging/prod + migraciones FI pendientes).
- Aplicación autorizada:

```bash
DNX_NOTIFICATIONS_ALLOW_MIGRATE=1 pnpm --filter @repo/db exec tsx scripts/apply-dnx-notifications-migration.mts
```

Smoke:

```bash
pnpm --filter @repo/db exec tsx scripts/smoke-dnx-notifications.mts
```

Tablas: `DnxNotificationEventLog`, `Preference`, `Campaign`, `Delivery`, `Attribution` + `canNotifyClfPhotographerCall`.

## Worker

- Código: `apps/infospot/lib/notifications/worker.ts`
- Config: `@repo/notifications` → `NOTIFICATION_WORKER_DEFAULTS` / `resolveWorkerConfig`
- Locking: `PROCESSING` + `lockedBy` + `lockExpiresAt` (lease); reclaim si expiró
- CLI: `pnpm --filter infospot notifications:worker`
- Cron: `/api/cron/notifications-outbox` cada 2 min (`vercel.json`), auth `CRON_SECRET`
- Kill switches: `DNX_NOTIFICATIONS_ENABLED` / `_CAMPAIGNS_` / `_CRON_` / `_EMAIL_` (`feature-flags.ts`; Production default OFF)
- Tras confirmar campaña se dispara un lote del worker (no deja la HTTP abierta para cientos de usuarios más allá del batch)

## Canales

| Canal | Estado |
|-------|--------|
| IN_APP | Operativo → `DashboardNotification` + `dashboardNotificationId` |
| EMAIL | Opt-in → `EmailQueue` (`idempotencyKey=dnx_notif_email:{deliveryId}`) → cron CLF Resend |
| Push/WA/SMS/Telegram | No |

Override QA email: `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` solo fuera de producción real.
En Vercel usar `VERCEL_ENV` (`preview` permite override; `production` lo ignora siempre),
porque `NODE_ENV` también es `production` en Preview. Implementación: `apps/infospot/lib/notifications/email-override.ts`.

## Preferencias

- Ruta CLF: `/fotografo/configuracion/notificaciones`
- Bandeja: `/fotografo/notificaciones`
- Defaults: IN_APP ON, EMAIL OFF
- Privacidad: sin lat/lng en UI

## Tracking

| Concepto | Persistencia |
|----------|--------------|
| Entregada | `sentAt` / `deliveredAt` |
| Leída | `Delivery.readAt` + `DashboardNotification.readAt` (idempotente) |
| Clic | `GET /n/[publicToken]` → `clickedAt` / `clickCount`; cookie `dnx_notif_attr` |
| Postulación | `DnxNotificationAttribution` desde cookie validada en join CLF (`attributeApplicationFromCookie`) |

Cookie `dnx_notif_attr`: httpOnly, SameSite=Lax, TTL 14d con `expiresAt`, Secure en HTTPS/Preview.
Open redirects bloqueados por hostname allowlist. Cross-app: el token vive en URL CLF; la cookie es del dominio CLF (no se comparte con InfoSpot).

## Métricas

`computeCampaignMetrics` / `reconcileCampaignMetrics`: pending, processing, sent, failed, read, click, application + rates (null si denominador 0).

## Panel administrativo (Etapa 20)

| Ruta | Uso |
|------|-----|
| `/admin/notificaciones` | Listado + filtros (estado, canal, ciudad, fechas, fallos, pendientes) |
| `/admin/notificaciones/[id]` | Resumen, métricas, exclusiones, entregas sanitizadas, acciones |
| Redacción → convocatoria | Preview/envío (`NearbyNotifyPanel`) |

Estados reales (`DnxNotificationCampaignStatus`): `DRAFT`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` (no existen READY/PARTIAL en el enum).

Entregas en UI: id opaco `u_<base36>`, sin email ni coordenadas de fotógrafo.

## Cancel / retry / process / reconcile

| Acción | Quién | Dónde |
|--------|-------|-------|
| Cancelar pendientes | Director / SUPER_ADMIN | Panel detalle + `cancelCampaignAction` |
| Reintentar fallidas | Director / SUPER_ADMIN | Panel detalle (no-op si 0 reencolables) |
| Procesar ahora | Director / SUPER_ADMIN | Solo no-prod o `DNX_NOTIFICATIONS_ALLOW_MANUAL_PROCESS=1` |
| Verificar consistencia | SUPER_ADMIN | Dry-run; apply con gate aparte |

## Kit QA

```bash
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-seed
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-flow
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup          # dry-run
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup -- --apply
```

Prefijo `[QA NOTIFICATIONS]` / tag `QA_NOTIFICATIONS_ETAPA20`. Bloqueado en production salvo force explícito.

## Permisos

`canProvisionClfPhotographerCall` ≠ `canNotifyClfPhotographerCall`. Guards en server actions.

## Variables de entorno

Ver `docs/notifications/notifications-operations-runbook.md`.

## Rollback

1. Cancelar campañas QUEUED/PROCESSING.
2. Detener cron outbox (quitar schedule o `CRON_SECRET`).
3. DDL es aditivo: no borrar tablas en caliente; rollback de código a Etapa 17/18 sin worker.

## Auditoría Etapa 18 (resumen)

Ver historial: no había paquete transversal; se reutilizó `DashboardNotification`, `EmailQueue`, `@repo/geo`.
