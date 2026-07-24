# Informe QA — Etapa 20 — Notificaciones DNX

Fecha: 2026-07-23  
Rama: `migration-legacy-clf-to-monorepo`  
HEAD al ejecutar: `952cf4d` (working tree con cambios locales de Etapa 20)  
Estado final: **APROBADO CON PENDIENTES MANUALES**  
Seguimiento browser/cron: ver `notifications-etapa-21-browser-qa-report.md`.


---

## A. Preflight

| Ítem | Valor |
|------|-------|
| Repo | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` (ahead del remote) |
| DB | Neon `ep-dawn-dew-***` (staging histórico / host ambiguo documentado; **no** prod-primary) |
| `NODE_ENV` en flow | `development` |
| `CRON_SECRET` | **missing** en entorno local usado |
| `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` | **missing** |
| Migraciones globales | No ejecutadas |
| URLs locales | InfoSpot `:3004` · CLF (app monorepo `compramelafoto`) |

Confirmación: no se tocó producción; no commit; no push.

---

## B. Datos QA

Script: `DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-*`

| Recurso | Cantidad (seed) |
|---------|-----------------|
| Fotógrafos QA | 15 |
| Eventos InfoSpot | 6 |
| Events CLF | 4 |
| Prefijo | `[QA NOTIFICATIONS]` |
| Tag | `QA_NOTIFICATIONS_ETAPA20` |
| Emails | `qa-notif-*@dnx-qa-notifications.invalid` |

Casos cubiertos: radios Rosario, Santa Fe, CABA, sin coords, inactivo, prefs off, solo IN_APP, IN_APP+EMAIL, email inválido, ya postulado, fallback ciudad.

Cleanup dry-run (tras qa-flow): users=15, events=6, clfEvents=4, campaigns=2.  
Cleanup `--apply` OK; dry-run final: **ceros** en recursos QA.

---

## C. Panel administrativo

| Ruta | Estado |
|------|--------|
| `/admin/notificaciones` | Implementado: filtros + métricas de listado |
| `/admin/notificaciones/[id]` | Implementado: resumen, exclusiones, entregas sanitizadas |
| Acciones | Cancelar, reintentar, procesar ahora (no-prod), reconcile dry-run / apply |

Permisos: ver con `canNotify` o Director; cancel/retry Director+; reconcile SUPER_ADMIN; process gate no-prod.

---

## D. QA geográfico (evidencia `notifications:qa-flow`)

| Ciudad | Radio | Encontrados | Elegibles | Excluidos | Resultado |
|--------|-------|-------------|-----------|-----------|-----------|
| Rosario | 10 km | 23 | 3 | 20 | OK |
| Rosario | 25 km | 23 | 4 | 19 | OK |
| Rosario | 50 km | 23 | 5 | 18 | OK |
| Rosario | 100 km | 23 | 6 | 17 | OK |
| Rosario | ciudad | 23 | 8 | 15 | OK |
| Rosario | provincia | 23 | 10 | 13 | OK |
| Santa Fe | 25 km | 23 | 2 | 21 | OK |
| Santa Fe | 50 km | 23 | 2 | 21 | OK |
| Santa Fe | ciudad | 23 | 1 | 22 | OK |
| Santa Fe | provincia | 23 | 12 | 11 | OK |
| CABA | 25 km | 23 | 1 | 22 | OK |
| CABA | 50 km | 23 | 1 | 22 | OK |
| CABA | ciudad | 23 | 1 | 22 | OK |
| CABA | provincia | 23 | 1 | 22 | OK |

Nota: `found=23` incluye fotógrafos reales de la DB staging + seed QA; elegibles crecen con el radio en Rosario y no mezclan CABA en radios cortos.

---

## E. QA IN_APP

| Check | Resultado |
|-------|-----------|
| Campaña creada | OK (`send` eligible=5, queued=7) |
| Worker envió | sent=6, failed=1 (email inválido esperado) |
| `DashboardNotification` | dashboardRecent=5 |
| Segunda pasada worker | claimed=0 (sin duplicar) |
| Estado campaña | COMPLETED (antes del bug de retry noop → corregido) |
| Bandeja UI / marcar leída | **Pendiente manual** (sin sesión browser QA) |
| CTA `/n/[token]` | Código Etapa 19; **pendiente click manual** |

---

## F. QA EMAIL

| Check | Resultado |
|-------|-----------|
| Opt-in → EmailQueue | emailQueueRecent=1 |
| Email inválido | 1 failed controlado (`INVALID_RECIPIENT`) |
| Override sandbox | No configurado |
| Resend externo | **No validado** (sin credenciales/override) |
| Baja / prefs | Cubierto por tests motor + seed prefs-off |

---

## G. QA atribución

Validado en código Etapa 19 + tests unitarios.  
**Pendiente manual:** postulación real con cookie desde CTA en browser CLF.

---

## H. QA operacional

| Check | Resultado |
|-------|-----------|
| Cancel antes de worker | cancelledPending=5; pendingAfterWorker=0; workerClaimed=0 |
| Retry noop | Corregido: ya no fuerza `QUEUED` si requeued=0 |
| Reconcile dry-run | expiredLocks=0, stuck=[], inAppWithoutDash=0 |
| Cron auth | Código exige `CRON_SECRET`; secreto **no** presente en local → 503 esperado |
| Cron staging Vercel | Schedule `*/2` en `vercel.json`; configuración externa del secreto **pendiente** |

---

## I. Permisos

| Rol | Ver panel | Preview/enviar | Cancel/retry | Process now | Reconcile |
|-----|-----------|----------------|--------------|-------------|-----------|
| SUPER_ADMIN | sí | sí | sí | sí (no-prod) | sí |
| Director | sí | sí | sí | sí (no-prod) | no |
| Editor + notify | sí | sí | no | no | no |
| Editor solo provision | no acciones notify | no | no | no | no |
| Sin permisos | redirect | no | no | no | no |

Retiro de permiso en sesión activa: guard en server actions (misma lógica Etapa 19); **pendiente prueba UI manual**.

---

## J. Tests

| Suite | Resultado |
|-------|-----------|
| `@repo/notifications test` | 23/23 OK |
| `@repo/notifications check-types` | OK |
| `infospot test:etapa-18/19/20` | OK |
| `infospot` browser-contract | OK (sin Playwright) |
| `infospot check-types` | OK |
| `compramelafoto typecheck` | Falla por errores **preexistentes** `@repo/payments` (BigInt target, exports dual-read, etc.) — no tocados |

Playwright InfoSpot: **no existe** infraestructura; no se añadió dependencia. Cobertura browser = contrato de archivos + QA manual pendiente.

---

## K. Evidencias

- JSON completo del flow en ejecución local `notifications:qa-flow` (2026-07-23).
- Campañas anonimizadas: `cmrxyhzm…` (cancelada), `cmrxyi5z…` (enviada).
- Logs worker con `scope=dnx_notifications_worker` sin tokens/emails completos.

---

## L. Archivos principales modificados/creados

- `apps/infospot/lib/notifications/qa-kit.ts`
- `apps/infospot/scripts/notifications-qa-{seed,cleanup,flow}.ts`
- `apps/infospot/lib/notifications/campaign-admin.ts`
- `apps/infospot/lib/notifications/campaign-ops.ts` (retry noop)
- `apps/infospot/app/admin/notificaciones/**`
- `apps/infospot/components/admin/notification-campaign-ops.tsx`
- `apps/infospot/components/redaccion/nearby-notify-panel.tsx`
- `apps/infospot/app/actions/{nearby-notify,notification-campaigns}.ts`
- `apps/infospot/lib/notifications/nearby-call-campaign.ts`
- `apps/infospot/lib/notifications/etapa-20-*.test.ts`
- `docs/notifications/*`

---

## M. Datos de prueba

Cleanup `--apply` ejecutado tras el flow: eliminó usuarios/eventos/CLF QA (campaigns ya borradas en intento previo).  
Nota: `EventNearbyPhotographerNotification` no existe en este host; el cleanup la ignora.  
Dry-run posterior debe reportar ceros en recursos QA.

---

## N. Pendientes reales

1. QA manual en navegador (roles, bandeja CLF, lectura, clic, atribución join).
2. Configurar `CRON_SECRET` en staging InfoSpot y pegar el cron.
3. Validar Resend sandbox con `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` (hasta EmailQueue ya OK).
4. Playwright InfoSpot (decisión de producto; hoy no hay stack).

---

## O. Estado final

**APROBADO CON PENDIENTES MANUALES**

Motivo: panel + seed + geo + worker + IN_APP/EmailQueue + cancel + reconcile + tests técnicos verificados con evidencia; falta browser manual, cron secret staging y envío Resend externo.
