# Rollback — Notifications Engine

## Principios

1. Preferir **kill switch** y roll-forward sobre borrar schema.
2. La migración 18 es **aditiva** (`IF NOT EXISTS`) — no hay drop.
3. No borrar campañas enviadas ni entregas ya vistas por usuarios.
4. No tocar Production en Etapa 23.

---

## A. Rollback lógico (inmediato)

Orden recomendado (Production):

```text
DNX_NOTIFICATIONS_ENABLED=0
# o, más fino:
DNX_NOTIFICATIONS_CAMPAIGNS_ENABLED=0
DNX_NOTIFICATIONS_CRON_ENABLED=0
DNX_NOTIFICATIONS_EMAIL_ENABLED=0
```

Efectos:

| Gate | Efecto |
|------|--------|
| Master OFF | Campañas, cron y email OFF |
| Cron OFF | Endpoint responde `{ ok:true, paused:true }` tras auth |
| Campaigns OFF | `confirmAndSend` falla `FEATURE_DISABLED` |
| Email OFF | Delivery EMAIL → `CHANNEL_DISABLED` (no encola) |

Adicional:

1. Cancelar campañas `QUEUED`/`PROCESSING` desde panel (Director/SUPER_ADMIN).
2. Ocultar acciones de envío a editores (permiso `canNotify` o UI).
3. Conservar bandeja IN_APP ya entregada.

---

## B. Rollback de aplicación

1. Redeploy de la revisión anterior de InfoSpot/CLF.
2. Schema nuevo **puede permanecer** — código viejo ignora tablas Dnx* si no las usa.
3. Evitar deploy de código **nuevo** contra DB **sin** migración 18 (rompe Prisma client).
4. Compatibilidad: versión anterior HEAD (sin motor) + tablas presentes = OK.

---

## C. Rollback de datos

| Acción | Permitido |
|--------|-----------|
| Cancelar deliveries PENDING | Sí |
| Detener worker/cron | Sí |
| Borrar SENT / attributions reales | **No** |
| Borrar campañas históricas | **No** (salvo QA con cleanup gate) |
| Cleanup QA (`[QA NOTIFICATIONS]`) | Solo con `DNX_NOTIFICATIONS_QA_ALLOW_SEED=1` |

---

## D. Rollback de migración

| Opción | Recomendación |
|--------|---------------|
| `DOWN` destructivo | **No** |
| Dejar tablas/columnas | **Sí** (innocuas si flags OFF) |
| Quitar fila `_prisma_migrations` | Solo si se re-aplica el mismo SQL en host limpio |

Columnas/tablas que pueden quedar:

- `InfoSpotUserRole.canNotifyClfPhotographerCall`
- `DnxNotification*` (EventLog, Preference, Campaign, Delivery, Attribution)
- Enums asociados

---

## E. Procedimiento de pausa (operaciones)

1. Set flags OFF en Vercel Production (sin tocar Preview).
2. Redeploy o esperar que env tome efecto (según plataforma).
3. `notifications:reconcile` dry-run.
4. Verificar cron: auth OK + `paused:true` o 0 claimed.
5. Comunicar a editores: envío cerrado.
