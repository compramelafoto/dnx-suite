# ComprameLaFoto — flujo álbum → carrito → checkout (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Migración:** `20260709230000_add_clf_album_checkout_flow_gap`  
**DB:** Neon staging `ep-round-fog-a4xgibtv`  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Hallazgo de rutas (legacy = monorepo)

| Paso | URL real | Notas |
| ---- | -------- | ----- |
| Álbum | `/album/[slug]` (entrada `/a/...` → 308) | Ya en monorepo |
| Visor foto | *inline* en álbum (modal) + `GET /api/photos/{id}/view` | Sin ruta propia de página |
| Carrito | `/a/{albumId}/comprar?photoIds=` | **No** `/cart` ni `/carrito` |
| Checkout | `/a/{albumId}/comprar/resumen` | **No** `/checkout` |
| Datos (opcional) | `/a/{albumId}/comprar/datos` | Paso intermedio |

Legacy Desktop y monorepo ya tienen estas rutas. **No se importó** código de carrito/checkout (paridad existente).  
`/cart`, `/carrito`, `/checkout` → 404 **por diseño** en ambos.

Estado de selección: `sessionStorage` (`lib/album-checkout-selection.ts`).

---

## Gaps de schema cerrados

| Objeto | Acción |
| ------ | ------ |
| `PackDefinition` | CREATE TABLE |
| `BenefitDefinition` | CREATE TABLE |
| Enums pack | `PackBenefitKind`, `BenefitTemplatePolicy`, `BenefitSelectionMode`, `PackAvailabilityPhase` |
| `Photo.previewWatermarkedKey` | ADD COLUMN (nullable) |
| `Photo.variantsStatus` (+ version/generatedAt/error) | ADD COLUMN + enum `PhotoVariantsStatus` |

Sin FK a `CatalogProduct` / `AlbumCatalogProduct` (ausentes en staging).  
Sin `PackPurchaseEntitlement` / `RedemptionSession` (no requeridos para abrir álbum con fotos → carrito digital).

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

## Aplicación staging / preview / pruebas

*(Completar tras deploy.)*

| Check | Resultado |
| ----- | --------- |
| Target DB | `ep-round-fog` confirmado |
| `prisma migrate deploy` | TBD |
| commit / push | TBD |
| preview READY | TBD |
| login / home / álbum / fotos / selección / carrito / checkout / blog | TBD |
| Mercado Pago | no iniciar pago; registrar sandbox faltante |
| gap residual | TBD |
