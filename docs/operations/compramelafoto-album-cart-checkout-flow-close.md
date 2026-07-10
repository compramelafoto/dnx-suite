# ComprameLaFoto — flujo álbum → carrito → checkout (staging)

**Fecha:** 2026-07-10  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit:** `7abd78f` — `fix(clf): restore album cart and checkout flow`  
**Migración:** `20260709230000_add_clf_album_checkout_flow_gap`  
**DB:** Neon staging `ep-round-fog-a4xgibtv`  
**Preview:** https://compramelafoto-dnxsuite-a1sw0djg8-compramelafotos-projects.vercel.app (`dpl_6SjBjmpu7mzqSK3NKjvfXbeGTZwn` READY)  
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

## Gaps de schema cerrados (esta migración)

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

## Aplicación staging

| Check | Resultado |
| ----- | --------- |
| Target DB | `ep-round-fog` confirmado |
| `prisma migrate deploy` | **OK** (solo `20260709230000…`; Infospot posteriores aisladas) |
| Push | `7abd78f` → `migration-legacy-clf-to-monorepo` |
| Preview READY | **OK** |

---

## Pruebas bypass (preview)

| Check | Resultado |
| ----- | --------- |
| `POST /api/auth/login` | **OK** 200 |
| Home / `GET /api/public/albums` | **OK** (1 álbum demo) |
| `GET /a/staging-clf-demo-album` → `/album/...` | **FAIL** 500 |
| Fotos visibles en álbum | **NO** (bloqueado por álbum) |
| `GET /api/photos/1/view` | **404** `{"error":"Preview no disponible"}` (ya no P2022) |
| `GET /a/1/comprar?photoIds=1` | **OK** 200 (ruta real carrito) |
| `GET /a/1/comprar/resumen` | **OK** 200 (ruta real checkout; sin iniciar MP) |
| `GET /cart` `/carrito` `/checkout` | **404** por diseño |
| `GET /blog` | **OK** 200 |

### Mercado Pago

- No se inició pago.
- Checkout renderiza en `/a/1/comprar/resumen`.
- Variables sandbox en preview pull: **ninguna** `MP_*` / `MERCADO*` presente en `.env.preview` → gap residual de env sandbox.

---

## Gap residual exacto (NO se creó migración en cascada)

| Ruta / endpoint | Error |
| --------------- | ----- |
| `GET /album/staging-clf-demo-album` | **P2021** `public.AlbumFolder` — `prisma.albumFolder.findMany()` |
| `GET /api/photos/{id}/view` | **404** negocio: `Preview no disponible` (columna OK; seed sin preview watermarked usable) |
| MP sandbox envs | Ausentes en preview |

**Siguiente migración sugerida (reportada, no aplicada aquí):** crear `AlbumFolder` (+ índices/FKs del schema) para desbloquear la galería pública.
