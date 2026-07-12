# Provisioning Info Spot → ComprameLaFoto (outbound / bidireccional)

## Propósito

El redactor configura y provisiona una convocatoria de fotógrafos desde Info Spot. CLF crea/actualiza el `Event`, genera `/e/{shareSlug}` y administra inscripciones. Info Spot conserva el vínculo `InfoSpotContentOrigin` BIDIRECTIONAL y el control editorial.

## Casos

| Caso | Comportamiento |
|------|----------------|
| A Redacción | Draft + botón «Crear convocatoria en CLF» |
| B Intake público | Guarda intención (`InfoSpotPhotographerCall` PENDING); **no** provisiona hasta acción editorial |
| C Ya importado CLF | Reutiliza `externalId`; UPDATE; dirección → BIDIRECTIONAL |
| D Ya provisionado | UPDATE, nunca CREATE duplicado |

## Modelo

`InfoSpotPhotographerCall` — configuración operativa separada del contenido editorial.

Estados `provisioningStatus`: `NOT_REQUESTED` | `PENDING` | `BLOCKED` | `PROVISIONING` | `PROVISIONED` | `FAILED` | `CLOSED`.

## Identidad organizador

Lookup en DB CLF por `organizerEmail`. Sin cuenta → `BLOCKED` (no se crean usuarios automáticamente).

Campos: `ownershipStatus`, `organizerUserId`, `organizerEmail`, `provisioningBlockedReason`.

## Escritura CLF

Bases separadas. Cliente: `getClfWriteClient()` con:

- `CLF_WRITE_DATABASE_URL`, o
- `ALLOW_CLF_WRITE_FROM_INFOSPOT=true` + `CLF_READONLY_DATABASE_URL` (staging)

Dominio compartido: `createClfEvent` / `updateClfEvent` / `closeClfEventCall` en `@repo/db`.

## Idempotencia y loops

- Busca origen `COMPRAMELAFOTO`+`EVENT` antes de crear.
- Outbound marca `echoGuard`, `lastOutboundAt`, `outboundPayloadHash`.
- Inbound confirma eco en ventana de 5 min sin reaplicar ni re-disparar outbound.

## Ownership post-provision

CLF controla operación (visibility, joinPolicy, cupos, members, status). Info Spot controla editorial y puede solicitar update/cierre vía provisioning.

## Cierre

«Cerrar convocatoria» → `Event.status=CLOSED`. No borra Event ni miembros. Desmarcar checkbox con PROVISIONED exige cierre explícito.

## Join público

Rutas restauradas:

- `POST /api/public/events/[shareSlug]/join`
- `DELETE /api/public/events/[shareSlug]/leave`

OPEN → `enrollPhotographerInEvent`; REQUEST → PENDING; CLOSED/PRIVATE sin invitación → rechazo.

## CLI

```bash
pnpm --filter infospot provision:clf-event -- --event-id <id>
pnpm --filter infospot provision:clf-event -- --event-id <id> --close
```

## Qué no incluye

Álbumes editoriales, selector de fotos, notificaciones, geocodificación automática, Info Spot duplicando inscripción.
