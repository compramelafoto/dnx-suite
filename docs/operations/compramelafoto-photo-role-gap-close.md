# ComprameLaFoto — Photo + Role.SCHOOL_ORGANIZER gap (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit:** `8221cd7` — `fix(db): add clf photo fields and school organizer role`  
**Migración:** `20260709210000_add_clf_photo_and_role_gap`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv`  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Tras AlbumPack/OrganizerPublicProfile:

- Home / albums API / login / blog OK
- Álbum demo 500 — `Photo.folderId`
- Vista foto 500 — `Photo.thumbWatermarkedKey`
- Checkout 500 — enum `Role` sin `SCHOOL_ORGANIZER`

---

## Auditoría

| Objeto | Schema | Staging antes |
| ------ | ------ | ------------- |
| `Photo.folderId` | `Int?` | ausente |
| `Photo.eventFolderId` | `Int?` | ausente (mismo select álbum) |
| `Photo.thumbWatermarkedKey` | `String?` | ausente |
| `Role.SCHOOL_ORGANIZER` | en enum | ausente |
| `AlbumFolder` / `EventFolder` | en schema | **ausentes** → sin FK |

Nota: coexiste con `20260709210000_add_infospot_editorial_cms` (ya aplicada).

---

## Objetos creados

- Enum value: `Role.SCHOOL_ORGANIZER`
- Columnas: `Photo.folderId`, `Photo.eventFolderId`, `Photo.thumbWatermarkedKey`
- Índices: `Photo_folderId_idx`, `Photo_eventFolderId_idx`
- Sin FK a carpetas

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
| `prisma migrate deploy` | **OK** |
| Push | `8221cd7` → `migration-legacy-clf-to-monorepo` |
| Preview | https://compramelafoto-dnxsuite-p2l7ddff4-compramelafotos-projects.vercel.app (`dpl_CdJkYBWAFRmcR5XDv4XbijREzXGT` READY) |

---

## Pruebas bypass (preview nuevo)

| Check | Resultado |
| ----- | --------- |
| Login | **OK** 200 |
| `GET /api/public/albums` | **OK** 200 |
| `/a/staging-clf-demo-album` | **Error** 500 |
| Abrir foto | **Error** 500 |
| `/cart` `/carrito` | 404 (sin ruta pública) |
| `/checkout` | 404 HTTP; **ya no** falla por `SCHOOL_ORGANIZER` (log info, no 500 enum) |
| Blog | **OK** 200 |

### Gaps residuales (sin bridge)

| Error | Detalle |
| ----- | ------- |
| P2021 | `PackDefinition` table missing — bloquea página álbum |
| P2022 | `Photo.previewWatermarkedKey` — bloquea `/api/photos/[id]/view` |

Producción no tocada.
