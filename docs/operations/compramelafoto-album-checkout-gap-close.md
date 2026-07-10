# ComprameLaFoto — AlbumPack + OrganizerPublicProfile gap (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit:** `b5f4435` — `fix(db): add clf album packs and organizer profile gap`  
**Migración:** `20260709180000_add_clf_album_packs_organizer_profile_gap`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv` (preview)  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Preview previo: login / blog / home / `GET /api/public/albums` OK; álbum demo y checkout fallaban por tablas ausentes.

---

## Schema audit

Nombres legacy pedidos (`AlbumPackItem`, `AlbumPackPriceTier`, `AlbumPackRule`, `AlbumPackSelection`) **no existen** en `schema.prisma` actual.

| Modelo | Rol |
| ------ | --- |
| `AlbumPack` | Packs (`Album.packs`) |
| `AlbumPackComponent` | Componentes DIGITAL/PRINT/DESIGN |
| `AlbumPackSelectionSession` | Sesión de selección |
| `AlbumPackOrderDraft` | Borrador de orden |
| `AlbumPackSelectionPhoto` | Fotos de sesión |
| `OrganizerPublicProfile` | Landing pública organizador |
| `OrganizerOfficialPhotographer` | Fotógrafos oficiales |
| `OrganizerFeaturedGallery` | Galerías destacadas |
| `OrganizerLandingSponsor` | Sponsors |

Enums: `AlbumPackComponentKind`, `AlbumPackAvailabilityPhase`, `AlbumPackType`, `AlbumPackSelectionStatus`, `AlbumPackOrderDraftStatus`.

**Nota:** `AlbumPack.templateV2Id` sin FK (`TemplateV2*` ausente en staging).

---

## Objetos creados

**Enums (5):** `AlbumPackComponentKind`, `AlbumPackAvailabilityPhase`, `AlbumPackType`, `AlbumPackSelectionStatus`, `AlbumPackOrderDraftStatus`

**Tablas (9):** `AlbumPack`, `AlbumPackComponent`, `AlbumPackSelectionSession`, `AlbumPackOrderDraft`, `AlbumPackSelectionPhoto`, `OrganizerPublicProfile`, `OrganizerOfficialPhotographer`, `OrganizerFeaturedGallery`, `OrganizerLandingSponsor`

Índices + FKs a `Album`, `Template`, `PhotographerProduct`, `Photo`, `User`, `Event`.

---

## Validaciones locales

| Check | Resultado |
| ----- | --------- |
| `prisma validate` | OK |
| `compramelafoto` typecheck / lint / build | OK |
| `compramelafoto-workers` typecheck / build | OK |

---

## Aplicación staging

| Check | Resultado |
| ----- | --------- |
| Target | `ep-round-fog` confirmado |
| `prisma migrate deploy` | **OK** |
| Push | `b5f4435` → `migration-legacy-clf-to-monorepo` |
| Preview | https://compramelafoto-dnxsuite-9f50fpic8-compramelafotos-projects.vercel.app (`dpl_6vX4SRFwoDvPXPz8r7yHd6nexrfp` READY) |

---

## Pruebas bypass (preview nuevo)

| Check | Resultado |
| ----- | --------- |
| `POST /api/auth/login` | **OK** 200 (`fotografo.staging@clf.dnx.test`) |
| `GET /api/public/albums` | **OK** 200 (1 álbum) |
| `GET /a/staging-clf-demo-album` | **Error** 500 |
| Abrir foto `/api/photos/1/view` | **Error** 500 |
| Carrito / checkout | **Error** 500 en `/checkout` |
| `GET /blog` | **OK** 200 |

### Gaps residuales (sin bridge temporal)

| Error | Detalle |
| ----- | ------- |
| P2022 | `Photo.folderId` — bloquea página álbum (`select` de fotos) |
| P2022 | `Photo.thumbWatermarkedKey` — bloquea `/api/photos/[id]/view` |
| 22P02 | enum `Role` sin valor `SCHOOL_ORGANIZER` — bloquea `organizerPublicProfile.findFirst` en checkout (tabla ya existe) |

También ausentes en staging (relacionados): `Photo.eventFolderId`, tablas `AlbumFolder` / `EventFolder` (FK potenciales de `folderId`).

Producción no tocada.
