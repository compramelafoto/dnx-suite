# ComprameLaFoto — AlbumPack + OrganizerPublicProfile gap (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Migración:** `20260709180000_add_clf_album_packs_organizer_profile_gap`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv` (preview)  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Preview previo `compramelafoto-dnxsuite-bqqal80xe…`:

- Login / Blog / Home / `GET /api/public/albums` **OK**
- `/a/staging-clf-demo-album` → `/album/...` **500** — `AlbumPack` table missing (P2021)
- Checkout smoke **500** — `OrganizerPublicProfile` table missing (P2021)

---

## Schema audit (nombres reales)

No existen `AlbumPackItem` / `AlbumPackPriceTier` / `AlbumPackRule` / `AlbumPackSelection` en el schema actual.

| Modelo | Rol |
| ------ | --- |
| `AlbumPack` | Packs de álbum (relación `Album.packs`) |
| `AlbumPackComponent` | Componentes DIGITAL/PRINT/DESIGN |
| `AlbumPackSelectionSession` | Sesión de selección |
| `AlbumPackOrderDraft` | Borrador de orden pack |
| `AlbumPackSelectionPhoto` | Fotos de la sesión |
| `OrganizerPublicProfile` | Landing pública organizador |
| `OrganizerOfficialPhotographer` | Fotógrafos oficiales |
| `OrganizerFeaturedGallery` | Galerías destacadas |
| `OrganizerLandingSponsor` | Sponsors |

Enums: `AlbumPackComponentKind`, `AlbumPackAvailabilityPhase`, `AlbumPackType`, `AlbumPackSelectionStatus`, `AlbumPackOrderDraftStatus`.

**Nota:** `AlbumPack.templateV2Id` sin FK — tablas `TemplateV2*` ausentes en staging (fuera de alcance de este gap).

---

## Objetos creados

**Enums (5):** `AlbumPackComponentKind`, `AlbumPackAvailabilityPhase`, `AlbumPackType`, `AlbumPackSelectionStatus`, `AlbumPackOrderDraftStatus`

**Tablas (9):** `AlbumPack`, `AlbumPackComponent`, `AlbumPackSelectionSession`, `AlbumPackOrderDraft`, `AlbumPackSelectionPhoto`, `OrganizerPublicProfile`, `OrganizerOfficialPhotographer`, `OrganizerFeaturedGallery`, `OrganizerLandingSponsor`

Índices + FKs hacia `Album`, `Template`, `PhotographerProduct`, `Photo`, `User`, `Event` (sin FK a `TemplateV2`).

---

## Validaciones locales

| Check | Resultado |
| ----- | --------- |
| `prisma validate` | OK |
| `compramelafoto` typecheck | OK |
| `compramelafoto` lint | OK (0 errors) |
| `compramelafoto` build | OK |
| `compramelafoto-workers` typecheck | OK |
| `compramelafoto-workers` build | OK |

---

## Aplicación / verificación

| Check | Resultado |
| ----- | --------- |
| Target DB | `ep-round-fog` (confirmado) |
| `prisma migrate deploy` | TBD |
| Commit / push | TBD |
| Preview URL | TBD |
| Login | TBD |
| Álbum demo | TBD |
| Fotos / carrito / checkout | TBD |
| Blog | TBD |
| Gap residual | TBD |
