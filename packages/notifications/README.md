# @repo/notifications — DNX Notifications Engine

Motor compartido de notificaciones (dominio puro). Sin Prisma, Next.js ni proveedores concretos.

## Uso

```ts
import { NotificationEngine, createNotificationEvent } from "@repo/notifications";

const engine = new NotificationEngine();
const event = createNotificationEvent({
  type: "CLF_PHOTOGRAPHER_CALL_OPENED",
  sourceApp: "infospot",
  sourceEntityType: "InfoSpotPhotographerCall",
  sourceEntityId: callId,
});
```

## Agregar un evento

1. Añadir el tipo en `NOTIFICATION_EVENT_TYPES` (`contracts.ts`).
2. Definir `idempotencyKey` estable (`events.ts`).
3. En la app: registrar en `DnxNotificationEventLog` al ocurrir el hecho.
4. Implementar selector de audiencia + plantilla + acción de campaña (no envío automático).

## Agregar un canal

1. Declarar en `NOTIFICATION_CHANNELS`.
2. Implementar adaptador en la app (nunca simular éxito sin infra).
3. Respetar preferencias / consentimiento (`preferences.ts`).
4. Actualizar `IMPLEMENTED_CHANNELS` solo cuando haya cableado real.

## Integración actual

- **Canal activo:** `IN_APP` → `DashboardNotification` (CLF).
- **Email:** adaptador `UnwiredEmailAdapter` (falla explícita hasta cablear Resend/EmailQueue).
- **Primer flujo:** InfoSpot convocatoria CLF abierta → preview → envío confirmado.

Documentación completa: `docs/notifications/dnx-notifications-engine.md`.
