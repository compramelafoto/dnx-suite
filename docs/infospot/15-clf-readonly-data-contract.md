# Info Spot ↔ ComprameLaFoto — Contrato de datos read-only

**Fecha:** 2026-07-11  
**Variable:** `CLF_READONLY_DATABASE_URL`  
**CMS Info Spot:** sigue en `DATABASE_URL` / `@repo/db`

## Separación de conexiones

| Uso | Variable | Escrituras |
| --- | --- | --- |
| Artículos, settings, roles, InfoSpotEvent | `DATABASE_URL` | Sí (CMS) |
| Event / Album / Photo / User (CLF) | `CLF_READONLY_DATABASE_URL` | **Prohibidas** |

No reemplazar globalmente `DATABASE_URL`.  
No correr `migrate`, `db push`, seeds ni UPDATE/INSERT/DELETE sobre la URL CLF.

## Modelos Prisma utilizados (schema monorepo)

### Event (CLF)
- `id`, `title`, `startsAt`, `endsAt`, `city`, `locationName`
- `type` (`EventType`), `visibility` (`EventVisibility`)
- `archivedAt`, `mergedIntoId`, `creatorId` → `User` (organizador)
- **No tiene `province`**

### Album
- `id`, `title`, `publicSlug`, `eventId`, `userId` (fotógrafo dueño)
- `deletedAt`, `isHidden`, `isPublic`
- `firstPhotoDate`, `createdAt`, `expirationExtensionDays`, `cleanupStatus`
- Relación: `Event.albums[]` / `Album.event`

### Photo
- `id`, `albumId`, `userId` (uploader)
- `previewUrl`, `thumbWatermarkedKey`, `previewWatermarkedKey`
- `originalKey` — **nunca exponer a UI Info Spot en este paso**
- `isRemoved`, `storageDeletedAt`

### User
- Organizador: `Event.creator`
- Fotógrafo: `Album.user` / `Photo.uploadedBy`
- No hay modelo `Photographer` separado

## Disponibilidad comercial

Resolver compartido: `resolveClfAlbumCommercialAvailability` (`@repo/db`).

Estados: `AVAILABLE` | `REACTIVATABLE` | `UNAVAILABLE`  
Ancla: `firstPhotoDate` (fallback `createdAt`) + `expirationExtensionDays` + hide/retention days.

URL pública álbum: `{COMPRAMELAFOTO_PUBLIC_URL}/album/{publicSlug}`

## Cliente Info Spot

- `apps/infospot/lib/clf-readonly-db.ts` — Prisma + guard anti-escritura
- `apps/infospot/lib/clf-readonly-queries.ts` — queries tipadas
- Bloquea host conocido vacío (`ep-dawn-dew…`) usado por staging Info Spot sin CLF

## Seguridad

1. Confirmar host/DB enmascarados antes de auditar  
2. Solo `find*` / `count`  
3. Proxy bloquea `create/update/delete/$executeRaw*`  
4. Import de borradores escribe **solo** en DB Info Spot  
5. Fotos en redacción: preview/thumb, sin `originalKey`
