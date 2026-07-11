# Info Spot × CLF — auditoría previa (Paso 4)

## Modelos reales (`packages/db/prisma/schema.prisma`)

| Modelo | Campos clave | Relación |
|--------|--------------|----------|
| `Event` | `id`, `title`, `startsAt`, `endsAt`, `city`, `locationName`, `creatorId`, `visibility`, `status`, `archivedAt`, `shareSlug` | **Sin `province`**. Organizador = `creatorId` → User |
| `Album` | `id`, `publicSlug`, `userId` (fotógrafo), `eventId?`, `isHidden`, `isPublic`, `deletedAt`, `firstPhotoDate`, `expirationExtensionDays`, `expiresAt` (legacy), `reactivatedAt`, `cleanupStatus` | FK directo `Album.eventId` → `Event` |
| `Photo` | `id`, `albumId`, `previewUrl`, `originalKey`, `thumbWatermarkedKey?`, `previewWatermarkedKey?`, `userId?`, `isRemoved`, `storageDeletedAt?` | Sin width/height en Photo |

URL pública canónica del álbum: `/album/[publicSlug]` (base: `COMPRAMELAFOTO_PUBLIC_URL` / `NEXT_PUBLIC_COMPRAMELAFOTO_URL`).

## Reglas reales de caducidad (CLF)

Ancla: `firstPhotoDate` (fallback `createdAt`) + `expirationExtensionDays`.

- Hide / bloqueo compra: ~`hideAfterDays` (default **30**, env `ALBUM_CLEANUP_HIDE_DAYS`) + extensión — alineado a `apps/compramelafoto/lib/album-cleanup/eligibility.ts`
- Purga / no reactivable: ~`retentionDays` (default **45**, env `ALBUM_CLEANUP_RETENTION_DAYS`) + extensión
- `expiresAt` es legacy; no gobierna hide/purge
- `deletedAt` / `storagePurged` → `UNAVAILABLE`

Helper compartido: `resolveClfAlbumCommercialAvailability` en `@repo/db` (`packages/db/src/clf-album-availability.ts`).

## Arquitectura Info Spot

- Consulta vía `@repo/db` únicamente (sin imports desde `apps/compramelafoto`).
- Copia editorial permanente en R2 `infospot/editorial/{articleId}/{photoId}-*.jpg`.
- Relación normalizada: `InfoSpotArticleAsset` (`COVER` / `INLINE` / `GALLERY`).
- Idempotencia: unique `(sourceType, sourcePhotoId)` en `InfoSpotEditorialAsset` + unique `(articleId, assetId, usageType)` en `InfoSpotArticleAsset`.
- Preferencia: **reutilizar asset editorial global** por foto CLF; relación por artículo separada.

## Migraciones

| Migración | Contenido |
|-----------|-----------|
| `20260709210000_add_infospot_editorial_cms` | CMS base Info Spot |
| `20260710010000_add_infospot_article_assets` | `InfoSpotArticleAsset`, columnas `r2Key`/`imported*`, `eventLinked*` |

## Rutas / actions (Paso 4)

- Actions: `apps/infospot/app/actions/clf-link.ts`
- API: `/api/redaccion/clf-events`, `.../albums`, `.../photos`, `.../thumb`
- UI: `components/redaccion/clf-event-picker.tsx` (edición)
- Público: `EditorialFigure`, `AlbumCommerceCta`, CTAs según disponibilidad
