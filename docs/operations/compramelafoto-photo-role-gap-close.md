# ComprameLaFoto — Photo + Role.SCHOOL_ORGANIZER gap (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Migración:** `20260709210000_add_clf_photo_and_role_gap`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv`  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Tras el gap AlbumPack/OrganizerPublicProfile:

- Home / albums API / login / blog **OK**
- `/album/staging-clf-demo-album` **500** — `Photo.folderId`
- `/api/photos/1/view` **500** — `Photo.thumbWatermarkedKey`
- `/checkout` **500** — enum `Role` sin `SCHOOL_ORGANIZER`

---

## Auditoría

| Objeto | Schema | Staging antes |
| ------ | ------ | ------------- |
| `Photo.folderId` | `Int?` + index + FK→`AlbumFolder` | ausente |
| `Photo.eventFolderId` | `Int?` + index + FK→`EventFolder` | ausente |
| `Photo.thumbWatermarkedKey` | `String?` | ausente |
| `Role.SCHOOL_ORGANIZER` | en enum | ausente |
| `AlbumFolder` / `EventFolder` | modelos en schema | **tablas ausentes** → sin FK |

Nota: el timestamp `20260709210000` coexiste con `…_add_infospot_editorial_cms` (ya aplicada); Prisma aplica esta como pendiente.

---

## Migración

- `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCHOOL_ORGANIZER'`
- `Photo.folderId` / `eventFolderId` / `thumbWatermarkedKey` con `IF NOT EXISTS`
- Índices `Photo_folderId_idx`, `Photo_eventFolderId_idx`
- Sin FK (tablas carpeta ausentes)

---

## Validaciones locales

| Check | Resultado |
| ----- | --------- |
| `prisma validate` | OK |
| `compramelafoto` typecheck / lint / build | OK |
| `compramelafoto-workers` typecheck / build | OK |

---

## Aplicación / verificación

| Check | Resultado |
| ----- | --------- |
| migrate deploy | TBD |
| commit / push | TBD |
| preview | TBD |
| álbum / fotos / carrito / checkout / blog | TBD |
| gap residual | TBD |
