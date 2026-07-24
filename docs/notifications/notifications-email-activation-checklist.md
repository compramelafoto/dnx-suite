# Checklist — Activación EMAIL (Resend) sin prisa

Infraestructura real:

- Encolado: InfoSpot worker → `EmailQueue` (`idempotencyKey=dnx_notif_email:{deliveryId}`)
- Procesamiento: CLF `GET /api/cron/process-email-queue` (`apps/compramelafoto/vercel.json`, `*/1`)
- Envío: `RESEND_API_KEY` en proyecto **compramelafoto-dnxsuite** (no InfoSpot)
- Opt-in: `DnxNotificationPreference.channelEmail` + `nearbyPhotographerCalls`
- Kill switch: `DNX_NOTIFICATIONS_EMAIL_ENABLED` (+ master `DNX_NOTIFICATIONS_ENABLED`)
- Override QA: `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` solo Preview/local (`VERCEL_ENV≠production`)

## Checklist

1. [ ] Crear o seleccionar API key Resend con permisos mínimos (sending).
2. [ ] Configurar `RESEND_API_KEY` en CLF **Preview** (no Production hasta canary).
3. [ ] Verificar dominio / remitente autorizados en Resend.
4. [ ] Confirmar `EMAIL_FROM` / reply-to según convención CLF existente.
5. [ ] Setear `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` **solo Preview** a buzón controlado.
6. [ ] Confirmar `DNX_NOTIFICATIONS_EMAIL_ENABLED=1` en Preview (o default ON).
7. [ ] Fotógrafo QA con opt-in EMAIL; sin opt-in → no delivery EMAIL.
8. [ ] Worker notificaciones crea **una** fila EmailQueue; segunda corrida no duplica.
9. [ ] Cron CLF procesa cola; Resend acepta mensaje.
10. [ ] Destinatario = override (no email real del fotógrafo).
11. [ ] Subject/body/CTA con token `/n/...` válidos.
12. [ ] Link de preferencias funciona; baja desactiva futuros EMAIL.
13. [ ] Retirar override **antes** de cualquier envío Production.
14. [ ] Production: `DNX_NOTIFICATIONS_EMAIL_ENABLED=0` hasta Fase 3 canary.
15. [ ] Monitorear rebotes / FAILED en EmailQueue tras primeros envíos.
16. [ ] No activar desde esta etapa (solo preparación).

## Bloqueos actuales (Etapa 23)

- `RESEND_API_KEY` ausente en Preview InfoSpot/CLF (validado E22).
- `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` no configurado en Preview.
- No simular envío Resend sin credenciales.

## Canary EMAIL (resumen)

Ver informe readiness Fase 3: máx. 10 emails opt-in, dominio verificado, kill switch listo.
