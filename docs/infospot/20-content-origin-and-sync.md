# Orígenes de contenido y sincronización (Info Spot)

## Propósito

`InfoSpotContentOrigin` vincula contenido editorial (`InfoSpotArticle` / `InfoSpotEvent`) con identidades externas (ComprameLaFoto, CSV, IA, redes, APIs) **sin mezclar** datos editoriales ni estados del workflow.

Es la base para:

```text
CLF → Info Spot (INBOUND)
Info Spot → CLF (OUTBOUND / BIDIRECTIONAL)
```

## Modelo

Tabla: `InfoSpotContentOrigin`

| Campo | Rol |
|-------|-----|
| `contentType` + `articleId` / `eventId` | Destino editorial (XOR + CHECK) |
| `sourceType` | Plataforma (`COMPRAMELAFOTO`, `CSV`, …) |
| `externalEntityType` + `externalId` | Identidad en la fuente |
| `direction` | `INBOUND` / `OUTBOUND` / `BIDIRECTIONAL` |
| `syncStatus` | `PENDING` / `SYNCED` / `FAILED` / `STALE` / `DISABLED` |
| `operationalPayload` | Snapshot operativo JSON |
| `lastSyncedAt` / `lastAttemptAt` / `syncError` | Auditoría de intentos |

`InfoSpotEvent.originKind` distingue ingreso (`REDACCION`, `PUBLIC_INTAKE`, `IMPORTED`, …) sin acoplar a CLF.

## Idempotencia

Índices únicos parciales:

- `(sourceType, externalEntityType, externalId, articleId)` WHERE `articleId IS NOT NULL`
- `(sourceType, externalEntityType, externalId, eventId)` WHERE `eventId IS NOT NULL`

Así un mismo álbum CLF puede vincularse a **varios artículos** y a un **evento**, sin duplicar el mismo par contenido↔externo.

## Ownership de campos

Ver `apps/infospot/lib/content-origin/field-ownership.ts`.

- **SOURCE**: fecha, ciudad, coords, cupos, URLs comerciales…
- **INFOSPOT**: título, bajada, cuerpo, SEO, estados editoriales…
- **INFOSPOT_AFTER_OVERRIDE**: portada inicial desde fuente; si el redactor la cambia, no se pisa.

## Direcciones

### INBOUND (CLF origina)

`CLF Event → ContentOrigin INBOUND → InfoSpotEvent DRAFT`

### OUTBOUND / BIDIRECTIONAL (Info Spot convoca)

`InfoSpotEvent → ContentOrigin OUTBOUND/BIDIRECTIONAL → CLF Event`

Tras crear en CLF, la operación de convocatoria vuelve por sync (etapa futura).

## Disponibilidad comercial

`resolveCommercialAvailability(origin)`:

- `AVAILABLE` / `HIDDEN` / `UNPUBLISHED` / `DELETED` / `UNKNOWN`
- Álbum eliminado → CTA y links de compra ocultos
- La imagen editorial puede conservarse si hay licencia (otra etapa)

## Soft refs legacy

`InfoSpotArticle.eventId` / `clfAlbumId` se **mantienen**.  
`createDraftFromClfEventAction` sigue escribiéndolos y además crea orígenes.

Backfill dry-run: `dryRunBackfillSoftRefsToContentOrigin({ dryRun: true })`.

## Código

- Dominio: `apps/infospot/lib/content-origin/`
- Adaptador CLF stub: `adapters/compramelafoto.ts`
- Migración: `20260712190000_infospot_content_origin`
