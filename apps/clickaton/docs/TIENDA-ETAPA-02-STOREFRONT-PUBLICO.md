# TIENDA — ETAPA 02 — Storefront público del catálogo

**Estado:** DONE  
**Fecha:** 2026-08-01  
**Restricciones respetadas:** sin commits, push, deploy, migraciones, Prisma, pagos, checkout ni inscripción.

---

## URLs creadas

| URL | Estado |
|-----|--------|
| `/tienda` | Página pública operativa |
| `/tienda/[storeSlug]` | Enlaces preparados desde cards; **página de detalle aún no existe** (etapa posterior) |

---

## Componentes creados

| Componente | Path |
|------------|------|
| `StoreHeader` | `components/store/StoreHeader.tsx` |
| `StoreProductCard` | `components/store/StoreProductCard.tsx` |
| `StoreProductGrid` | `components/store/StoreProductGrid.tsx` |
| `StoreEmptyState` | `components/store/StoreEmptyState.tsx` |
| barrel | `components/store/index.ts` |

---

## Componentes / utilidades reutilizados

- `PageHero`, `SimpleBreadcrumb`, `Container`, `Section`
- `Card`, `Badge`, `Button`, `FocusMark`, `EditorialLabel`
- `buildPageMetadata` (`lib/seo.ts`)
- `formatPublicPrice` (`lib/public-registration/ui/format.ts`)
- Prisma `ClickatonProduct` + `DnxMediaAsset` (catálogo existente)
- Layout público `(public)` / `SiteHeader` / `SiteFooter` (vía `mainNavigation`)

---

## Consultas implementadas

`listPublicStoreProducts()` en `lib/public-store/list-store-products.ts`:

1. `findMany` de `ClickatonProduct` con filtros:
   - `isActive: true`
   - `isStoreEnabled: true`
   - `storeStatus IN (ACTIVE, OUT_OF_STOCK)`
   - `storeSlug` y `storePrice` no nulos
2. Deduplicación por `storeSlug` (unique es por edición).
3. Batch de `DnxMediaAsset` por `primaryImageAssetId` (sin N+1).
4. Precio únicamente desde `storePrice` (nunca inscripción).
5. Ante error de DB → lista vacía (página no rompe).

---

## SEO

- Title absoluto: `Tienda | Clickatón`
- Description: `Comprá productos oficiales de Clickatón.`
- Open Graph + Twitter vía `buildPageMetadata`
- Canonical `/tienda`
- `revalidate = 60`

---

## Responsive

| Breakpoint | Columnas |
|------------|----------|
| Mobile (`default`) | 1 |
| Tablet (`sm`) | 2 |
| Desktop (`xl`) | 4 |

---

## Navegación

- `routes.store = "/tienda"`
- Ítem **Tienda** en `mainNavigation` (después de Comunidad) y `footerNavigation`
- Removido de `futureAreas`

---

## Riesgos

1. Seed Argentina 2026 deja `isStoreEnabled: false` / `storeStatus: DRAFT` → empty state hasta habilitar en admin.
2. Detalle `/tienda/[slug]` aún no existe (404 esperado al clicar “Ver producto”).
3. Imágenes con `<img>` (no `next/image`) por URLs R2/`/api/media` sin `remotePatterns`.
4. `storeSlug` unique por edición: dedupe global en listado.
5. Productos sin imagen: placeholder accesible, no rompe.

---

## Evidencias (archivos)

**Creados**

- `app/(public)/tienda/page.tsx`
- `components/store/*`
- `content/store.ts`
- `lib/public-store/*`
- `docs/TIENDA-ETAPA-02-STOREFRONT-PUBLICO.md`

**Modificados**

- `config/navigation.ts`
