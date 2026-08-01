# TIENDA — ETAPA 03 — Detalle de producto y base reutilizable DNX Suite

**Estado:** DONE  
**Fecha:** 2026-08-01  
**Restricciones:** sin commits, push, deploy, migraciones, Prisma, pagos, carrito, checkout, inscripción.

---

## Arquitectura implementada

Separación en capas:

1. **Datos Clickatón** — `getPublicStoreProductBySlug`, `listRelatedStoreProducts`, `listPublicStoreProducts` (`server-only` + Prisma).
2. **View model público** — `PublicStoreProductDetail` / `StoreProductCardDto` (sin tipos Prisma en UI).
3. **Componentes visuales** — `components/store/*` consumen DTOs.
4. **Acciones comerciales** — **no implementadas**; CTA deshabilitado (`StorePurchasePlaceholder`).

```
app/(public)/tienda/[storeSlug]/page.tsx
  → getPublicStoreProductBySlug (cache)
  → StoreProductDetailView
  → listRelatedStoreProducts → StoreRelatedProducts
```

---

## Consulta de producto

`getPublicStoreProductBySlug(storeSlug)`:

**Filtros públicos**

- `isActive = true`
- `isStoreEnabled = true`
- `storeStatus ∈ {ACTIVE, OUT_OF_STOCK}`
- `storeSlug` match (case-insensitive)
- `storePrice` definido

**Operaciones**

1. `findMany` candidatos por slug + metadatos de edición.
2. Resolución determinista del ganador.
3. `findUnique` del producto con `variants` + `media`.
4. Batch `DnxMediaAsset` por asset ids (sin N+1).

**React `cache()`** — comparte resultado entre `generateMetadata` y la página.

**Errores**

- No público / no existe → `null` → `notFound()` (sin filtrar diferencia).
- Error de DB → se propaga (no se convierte a 404 silencioso).

---

## Criterio de slugs duplicados

`storeSlug` es unique por `editionId`. Criterio en `resolve-store-slug.ts`:

1. Solo candidatos ya públicos.
2. Mayor **vigencia de edición**: `isPublished` (+1000) → `registrationEnabled` (+100) → score de `status`.
3. `updatedAt` más reciente.
4. `id` lexicográfico ascendente (estable).

El **listado** `/tienda` usa el mismo `pickStoreSlugWinner` para alinear card ↔ detalle.

---

## DTO público

`PublicStoreProductDetail`:

- id, slug, name, shortDescription, description
- price (`storePrice` minor), currency, priceLabel
- status, badge, editionId
- images[], primaryImage
- variants[] (availableStock, availability, selectable)
- availability (global)
- initialSelectedVariantId (solo si hay exactamente 1 seleccionable)

---

## Componentes creados

| Componente | Rol |
|------------|-----|
| `StoreProductGallery` | Galería + miniaturas (cliente) |
| `StoreProductInfo` | Nombre, badge, precio, descripciones |
| `StoreVariantSelector` | Talles/opciones reales |
| `StoreAvailability` | Disponible / Últimas unidades / Agotado |
| `StorePurchasePlaceholder` | CTA deshabilitado |
| `StoreProductOptionsPanel` | Isla cliente (variante + stock + CTA) |
| `StoreProductDetailView` | Layout ficha |
| `StoreRelatedProducts` | Relacionados (reusa grid/card) |

---

## Criterio de stock (presentación)

Constante `STORE_LOW_STOCK_THRESHOLD = 5` (solo UI; no hay regla de dominio previa):

| Stock público (`stock - reserved`) | Label |
|------------------------------------|-------|
| 0 | Agotado |
| 1–5 | Últimas unidades |
| > 5 | Disponible |

- `storeStatus === OUT_OF_STOCK` → producto Agotado.
- Variantes `availableStock === 0` → deshabilitadas + texto “Agotado”.
- Sin auto-selección si hay >1 variante disponible.
- **Sin** holds, descuentos de stock ni writes.

---

## SEO

- Title absoluto: `{Nombre} | Tienda Clickatón`
- Description: shortDescription sanitizada
- Open Graph + Twitter con imagen principal
- Canonical vía `buildPageMetadata`
- `notFound()` también en `generateMetadata` si no es público
- **JSON-LD Product** sin `Offer` (venta aún no activa) — documentado

---

## Accesibilidad

- Breadcrumb semántico
- Miniaturas con teclado / focus ring
- Radiogroup de variantes
- Estados “Agotado” en texto (no solo color)
- `aria-label` de precio
- Fallback de imagen con `role="img"`

---

## Pruebas

Script: `npm run test:public-store` en `apps/clickaton`.

Cubre: disponibilidad, resolución de slug, mapeo (ACTIVE/OUT_OF_STOCK/DRAFT/sin precio/sin imagen/variantes), guard de compra, JSON-LD sin Offer.

---

## Reutilización DNX Suite

### Reutilizable actualmente (dentro de Clickatón, DTO-first)

- Tipos `PublicStoreProductDetail`, `StoreProductCardDto`
- Reglas de availability / resolve-slug (puras)
- Componentes store que reciben props/DTO

### Específico de Clickatón

- Queries Prisma `ClickatonProduct*`
- Tokens `ck-*`, badge “Oficial Clickatón”
- Copy y rutas `/tienda`

### Candidatos a `packages/store-ui` (futuro)

- Tipos de presentación neutrales
- Gallery / VariantSelector / Availability / Grid / Card (con `className`)
- Formateo de precio desacoplado

### Extracción realizada

**No.** Se posterga.

**Justificación:** existe `packages/ui` / `packages/design-system`, pero los componentes actuales dependen del branding Clickatón (`ck-*`, `Badge`/`Button` locales). Extraer ahora generaría abstracción prematura o dependencias circulares. La frontera DTO + props ya habilita extracción segura después.

---

## Riesgos y deuda

1. Seed: productos suelen estar `isStoreEnabled=false` / `DRAFT` → 404 hasta habilitar en admin.
2. Imágenes con `<img>` (sin `next/image` / remotePatterns R2).
3. Sin categoría de producto → relacionados priorizan misma edición.
4. JSON-LD sin Offer hasta checkout.
5. Stock mostrado no reserva unidades (informativo).

---

## Acción legal

**NO requiere una acción legal inmediata** para esta implementación (solo vitrina).

Antes de habilitar ventas reales: revisar términos de compra, cambios/devoluciones, entregas, datos personales, información fiscal y productos personalizados.

---

## Evidencias

**Creados**

- `app/(public)/tienda/[storeSlug]/page.tsx`
- `components/store/StoreProductGallery.tsx`
- `components/store/StoreProductInfo.tsx`
- `components/store/StoreVariantSelector.tsx`
- `components/store/StoreAvailability.tsx`
- `components/store/StorePurchasePlaceholder.tsx`
- `components/store/StoreProductOptionsPanel.tsx`
- `components/store/StoreProductDetailView.tsx`
- `components/store/StoreRelatedProducts.tsx`
- `lib/public-store/get-store-product.ts`
- `lib/public-store/map-store-product.ts`
- `lib/public-store/availability.ts`
- `lib/public-store/resolve-store-slug.ts`
- `lib/public-store/product-json-ld.ts`
- `lib/public-store/*.test.ts`
- `docs/TIENDA-ETAPA-03-DETALLE-PRODUCTO.md`

**Modificados**

- `lib/public-store/types.ts`
- `lib/public-store/list-store-products.ts` (mismo criterio de slug)
- `lib/public-store/index.ts`
- `components/store/index.ts`
- `package.json` (`test:public-store`)
