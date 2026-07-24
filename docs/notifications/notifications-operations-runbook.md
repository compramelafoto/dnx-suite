# Runbook — DNX Notifications Engine

## Comandos

```bash
# Aplicar DDL (solo notificaciones; requiere flag)
DNX_NOTIFICATIONS_ALLOW_MIGRATE=1 pnpm --filter @repo/db exec tsx scripts/apply-dnx-notifications-migration.mts

# Smoke Prisma
pnpm --filter @repo/db exec tsx scripts/smoke-dnx-notifications.mts

# Worker local
pnpm --filter infospot notifications:worker

# Reconciliación (dry-run)
pnpm --filter infospot notifications:reconcile

# Reconciliación con escritura
pnpm --filter infospot notifications:reconcile -- --apply

# Kit QA Etapa 20
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-seed
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-flow
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup
DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup -- --apply
```

Cron InfoSpot: `GET /api/cron/notifications-outbox` cada `*/2` (`apps/infospot/vercel.json`) con `Authorization: Bearer $CRON_SECRET` o header `x-cron-secret`.

Panel: `/admin/notificaciones` (InfoSpot). Preview/envío en edición de evento con convocatoria abierta.

## Incidentes

### Campaña atascada
1. `notifications:reconcile` (dry-run) → revisar `stuckCampaigns`.
2. Liberar locks: `--apply`.
3. `notifications:worker`.
4. Si sigue atascada: Director → «Reintentar entregas fallidas».

### Emails fallidos
1. Revisar `EmailQueue` (`status=FAILED`, `idempotencyKey` prefijo `dnx_notif_email:`).
2. Confirmar Resend / `CRON` `process-email-queue` en CLF.
3. No reenviar duplicando: el worker reutiliza `emailQueueId` / idempotency.

### Worker detenido
1. Verificar `CRON_SECRET` en InfoSpot.
2. Ejecutar CLI local.
3. Revisar logs JSON `scope=dnx_notifications_worker`.

### Duplicados
- Clave `dedupeKey` única en delivery.
- IN_APP: si ya hay `dashboardNotificationId` o link+tipo, no recrea.
- EMAIL: `idempotencyKey` en EmailQueue.

### Métricas inconsistentes
```bash
pnpm --filter infospot notifications:reconcile -- --apply
```
Fuente de verdad: conteos desde `DnxNotificationDelivery` / `DnxNotificationAttribution`.

### Locks expirados
`releaseExpiredLocks` marca FAILED `LOCK_EXPIRED` y permite reintento.

### Campaña enviada por error
1. Cancelar pendientes (Director/SUPER_ADMIN).
2. No se retiran notificaciones ya entregadas.
3. Pedir opt-out a afectados si aplica.

### Cancelar pendientes
Acción server `cancelCampaignAction` → status `CANCELLED` en campaña y deliveries pendientes.

## Variables

Matriz completa: `notifications-environment-matrix.md`.

| Variable | Uso |
|----------|-----|
| `CRON_SECRET` | Auth cron outbox |
| `DNX_NOTIFICATIONS_ENABLED` | Master kill switch (Production default OFF) |
| `DNX_NOTIFICATIONS_CAMPAIGNS_ENABLED` | Crear/enviar campañas |
| `DNX_NOTIFICATIONS_CRON_ENABLED` | Worker HTTP; si OFF → `{paused:true}` tras auth |
| `DNX_NOTIFICATIONS_EMAIL_ENABLED` | Encolar EMAIL |
| `DNX_NOTIFICATIONS_ALLOW_MIGRATE` | Gate DDL |
| `DNX_NOTIFICATIONS_BATCH` | Tamaño lote CLI |
| `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` | Solo no-producción real (`VERCEL_ENV≠production`) |
| `DNX_NOTIFICATIONS_QA_ALLOW_SEED` | Gate seed/cleanup/qa-flow |
| `DNX_NOTIFICATIONS_ALLOW_MANUAL_PROCESS` | Habilita «Procesar ahora» en prod |
| `DNX_NOTIFICATIONS_ALLOW_RECONCILE_APPLY` | Habilita apply reconcile en prod |
| `NEXT_PUBLIC_CLF_SITE_URL` / `CLF_PUBLIC_SITE_URL` | Base URL `/n/[token]` |
| `RESEND_API_KEY` | CLF EmailQueue → Resend |

### Kill switch Production

```bash
# Pausa total
DNX_NOTIFICATIONS_ENABLED=0
```

Rollback: `notifications-release-rollback.md`. Release readiness: `notifications-etapa-23-release-readiness-report.md`.

## Errores frecuentes (UI)

| Mensaje | Causa |
|---------|-------|
| Sin permiso / «Puede avisar…» | Falta `canNotifyClfPhotographerCall` |
| Convocatoria no abierta / vencida | Call no elegible |
| Cero destinatarios | Alcance demasiado estrecho o prefs off |
| EMAIL sin opt-in | Canal EMAIL sin elegibles |
| Ubicación incompleta | Radio sin coords de evento |
| `CRON_SECRET not configured` | Cron 503 hasta setear secreto |
| unauthorized | Secreto incorrecto / ausente |

## Reproducir QA Etapa 20–21

1. Confirmar DB no-prod (`ep-dawn-dew` u otra staging documentada).
2. `DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-prepare-browser`.
3. Levantar InfoSpot `:3004` y CLF `:3002` con la **misma** `DATABASE_URL`.
4. `pnpm --filter infospot test:e2e:notifications` y/o `notifications:browser-smoke`.
5. Cron local: `CRON_SECRET=… BASE_URL=http://127.0.0.1:3004 pnpm --filter infospot notifications:cron-auth-check`.
6. Staging Vercel Preview: `CRON_SECRET` solo Preview (Etapa 22 ya seteado en branch); verificar 401/200 en deploy que **incluya** la ruta (código untracked requiere deploy local o commit).
7. Atribución UI: `notifications:qa-prepare-attribution` → E2E `notifications-attribution.spec.ts` → `notifications:qa-verify-attribution`.
8. Email: `EmailQueue` + override; Resend solo con sandbox (`DNX_NOTIFICATIONS_EMAIL_OVERRIDE` + `RESEND_API_KEY`).
9. Cleanup dry-run → `--apply` → dry-run ceros (borra también Album/Photo QA del join).
10. `notifications:reconcile` (incluye checks de attribution).

E2E contra Preview (opcional):

```bash
INFOSPOT_E2E_BASE_URL=https://… CLF_E2E_BASE_URL=https://… \
  pnpm --filter infospot test:e2e:notifications
```

Informes: `notifications-etapa-20-qa-report.md`, `notifications-etapa-21-browser-qa-report.md`, `notifications-etapa-22-staging-activation-report.md`.

**Nota Vercel:** los Cron Jobs del plan solo se ejecutan en **Production**. En Preview validar el endpoint con Bearer; no esperar invocación automática del scheduler.
