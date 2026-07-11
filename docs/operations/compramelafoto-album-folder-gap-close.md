# ComprameLaFoto — AlbumFolder gap (staging)

**Fecha:** 2026-07-11  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit:** `cebbfb4` — `fix(db): add clf album folder gap`  
**Migración:** `20260710010000_add_clf_album_folder_gap`  
**DB:** Neon staging `ep-round-fog-a4xgibtv`  
**Preview:** https://compramelafoto-dnxsuite-najh11jxy-compramelafotos-projects.vercel.app (`dpl_536ByT7u5nQRyqqQa1jMVdh5bXsF` READY)  
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
| FK `Photo_folderId_fkey` | ausente → **agregada** (segura: 0 filas con folderId) |

**Nota timestamp:** `20260710010000_add_infospot_article_assets` ya aplicada en staging; esta migración usa el mismo prefijo numérico con otro sufijo (`…_add_clf_album_folder_gap`).

---

## Objetos creados

- Tabla `AlbumFolder`
- Índices: `AlbumFolder_albumId_idx`, `AlbumFolder_parentId_idx`, `AlbumFolder_albumId_parentId_name_idx`
- FKs: `AlbumFolder_albumId_fkey`, `AlbumFolder_parentId_fkey`, `AlbumFolder_createdById_fkey`, `Photo_folderId_fkey`

---

## Validaciones locales

| Check | Resultado |
| ----- | --------- |
| `npx prisma validate` | **OK** |
| `pnpm --filter compramelafoto typecheck` | **OK** |
| `pnpm --filter compramelafoto build` | **OK** |
| `pnpm --filter compramelafoto lint` | **OK** |
| `pnpm --filter compramelafoto-workers typecheck` | **OK** |
| `pnpm --filter compramelafoto-workers build` | **OK** |

---

## Aplicación staging

| Check | Resultado |
| ----- | --------- |
| Target | `ep-round-fog` confirmado |
| `prisma migrate deploy` | **OK** |
| Push | `cebbfb4` → `migration-legacy-clf-to-monorepo` |

---

## Pruebas bypass (preview nuevo)

| Check | Resultado |
| ----- | --------- |
| `POST /api/auth/login` | **OK** 200 |
| `GET /api/public/albums` | **OK** 200 (1 álbum) |
| `GET /a/staging-clf-demo-album` → `/album/...` | **OK** 200 — “Fotos (3)”, UI selección |
| Carrito `/a/1/comprar?photoIds=1` | **OK** 200 |
| Checkout `/a/1/comprar/resumen` | **OK** 200 (sin iniciar MP) |
| Blog | **OK** 200 |
| P2021/P2022 nuevos | **No** |

---

## Gaps diferidos (fuera de alcance)

- Assets seed: `previewWatermarkedKey` null → `/api/photos/{id}/view` 404 negocio
- Mercado Pago sandbox envs ausentes en preview
