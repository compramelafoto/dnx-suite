# ComprameLaFoto — AlbumFolder gap (staging)

**Fecha:** 2026-07-11  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Migración:** `20260710010000_add_clf_album_folder_gap`  
**DB:** Neon staging `ep-round-fog-a4xgibtv`  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Tras PackDefinition / Photo watermark columns, el álbum público fallaba con:

`GET /album/staging-clf-demo-album` → **P2021** `public.AlbumFolder`

Carrito/checkout ya OK en `/a/{id}/comprar` y `/a/{id}/comprar/resumen`.

---

## Schema audit (`AlbumFolder`)

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| id | Int PK autoincrement | |
| albumId | Int | FK → Album CASCADE |
| parentId | Int? | self-FK AlbumFolderHierarchy RESTRICT |
| name | String | |
| path | String | ruta materializada |
| sortOrder | Int default 0 | |
| createdById | Int? | FK → User SET NULL |
| createdAt / updatedAt | DateTime | |

Índices: `albumId`, `parentId`, `[albumId, parentId, name]`.  
Enums: **ninguno**.  
`EventFolder`: **no requerido** por AlbumFolder.

`Photo.folderId` (nullable) ya existía sin FK; índice `Photo_folderId_idx` presente.

---

## Staging antes

| Objeto | Estado |
| ------ | ------ |
| Tabla `AlbumFolder` | **ausente** |
| `Photo.folderId` | presente, todos NULL |
| FK `Photo_folderId_fkey` | ausente → **se agrega** (segura) |

**Nota timestamp:** `20260710010000_add_infospot_article_assets` ya aplicada en staging; esta migración usa el mismo prefijo numérico con otro sufijo (`…_add_clf_album_folder_gap`).

---

## Objetos creados

- Tabla `AlbumFolder`
- Índices: `AlbumFolder_albumId_idx`, `AlbumFolder_parentId_idx`, `AlbumFolder_albumId_parentId_name_idx`
- FKs: albumId, parentId, createdById, `Photo.folderId` → `AlbumFolder.id`

---

## Validaciones / aplicación / pruebas

*(Completar tras deploy.)*
