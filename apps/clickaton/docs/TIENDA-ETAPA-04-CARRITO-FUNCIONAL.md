# TIENDA — ETAPA 04 — Carrito funcional y base reutilizable DNX Suite

**Estado:** DONE  
**Fecha:** 2026-08-01  
**Restricciones:** sin commits, push, deploy, migraciones, Prisma schema, pagos, pedidos, holds ni writes de inventario.

---

## Arquitectura

```
Browser (localStorage + Context/reducer)
  → POST /api/store/cart/validate
  → validateStoreCartItems (Prisma read-only)
  → ValidatedStoreCart (DTO canónico)
  → UI (drawer / página carrito)
```

Capas:

1. **Estado navegador** — `StoreCartProvider` + reducer + storage versionado  
2. **Contratos neutrales** — `lib/public-store/cart/types.ts`  
3. **Validación canónica Clickatón** — `validate-store-cart.ts` (server-only)  
4. **UI** — `components/store/cart/*`  
5. **Checkout futuro** — `ValidatedStoreCart.checkoutReady` siempre `false`  
6. **Branding Clickatón** — tokens `ck-*`, rutas `/tienda`

---

## Persistencia

| Campo | Valor |
|-------|--------|
| Clave | `dnx-store-cart:v1:clickaton` |
| Versión schema | `1` |
| Plataforma | `clickaton` |
| Contenido | `productId`, `variantId`, `quantity`, `addedAt` |

- JSON inválido / versión desconocida → carrito vacío + flag `recovered`  
- Sin `window` / storage bloqueado → tienda usable, carrito en memoria o vacío  
- Sync entre pestañas vía evento `storage`

**No se persisten:** nombre, precio, stock, imágenes, subtotales.

---

## Validación canónica

`POST /api/store/cart/validate`

**Payload:** `{ items: [{ productId, variantId, quantity }] }`  
**Límites:** max 40 ítems, body ≤ 24 KB, IDs `[a-zA-Z0-9_-]{8,64}`

**Consultas:** `findMany` productos por ids + variantes + batch `DnxMediaAsset` (sin N+1).

**Filtros públicos:** `isActive`, `isStoreEnabled`, `storeStatus ∈ {ACTIVE,OUT_OF_STOCK}`, `storePrice`, `storeSlug`.

**Precio:** exclusivamente `storePrice` (nunca del cliente; variantes sin precio propio).

**Stock:** `stock - reservedStock` informativo; **no** holds / writes.

**Estados de línea:** `valid`, `unavailable`, `outOfStock`, `insufficientStock`, `productHidden`, `variantMissing`, `variantDisabled`, `quantityAdjusted` (+ `priceChanged` preparado para UI).

---

## Cantidades

- Enteros ≥ 1  
- `STORE_CART_MAX_QUANTITY_PER_LINE = 10`  
- Máximo efectivo = `min(stock público, 10)`  
- Validación cliente (reducer/UI) + servidor

---

## Cálculos

- Minor units enteros (`unitPriceMinor * quantity`)  
- Subtotal general = suma de líneas con `contributesToSubtotal`  
- Líneas inválidas **excluidas** del subtotal  
- Format: `formatPublicPrice` / `formatArsDisplay`

---

## Stock (confirmación explícita)

- **No** se crean holds  
- **No** se modifica `stock`  
- **No** se modifica `reservedStock`  
- El carrito **no reserva** unidades  
- Copy: “Los productos no quedan reservados hasta confirmar la compra.”

---

## URLs

| URL | Rol |
|-----|-----|
| `/tienda` | Catálogo |
| `/tienda/[storeSlug]` | Ficha + agregar al carrito |
| `/tienda/carrito` | Página carrito (`noindex`) |
| `POST /api/store/cart/validate` | Validación canónica |

---

## Componentes creados

`StoreCartProvider`, `StoreCartButton`, `StoreCartDrawer`, `StoreCartLine`, `StoreCartQuantity`, `StoreCartSummary`, `StoreCartEmptyState`, `StoreCartIssues`, `StoreAddToCartPanel`, `StoreCartPageClient`

## Reutilizados

`StoreAvailability`, `StoreVariantSelector`, `StoreProductCard/Grid`, `Button`, `Card`, `SiteHeader`, layout público, `formatPublicPrice`, DTOs Etapa 03

---

## Reutilización DNX Suite

| | |
|--|--|
| Reutilizable ahora | types, reducer, storage, quantities, totals, schema, UI por props |
| Específico Clickatón | Prisma validate, rutas, branding, `storePrice` |
| Candidato paquete | `cart/*` core + UI tematizable |
| Extracción | **Postergada** — acoplamiento `ck-*` y layout Clickatón |

Arquitectura futura documentada: Store Core → Adapter Clickatón → Store UI → Checkout Adapter (DNX Payments).

---

## SEO / Privacidad / Seguridad

- `/tienda/carrito`: `robots: noindex, nofollow`  
- Sin datos personales en storage  
- Payload validado; precio/stock solo servidor  
- Analytics: no hay sistema canónico → no implementado  

---

## Acción legal

**NO requiere acción legal inmediata** (sin pagos ni órdenes).

Antes del checkout: términos de compra, cambios/devoluciones, entrega, privacidad, fiscalidad.

---

## Pruebas

`npm run test:public-store` — incluye `lib/public-store/cart/cart.test.ts`.

---

## Riesgos

1. Productos seed no habilitados para tienda → no se pueden agregar.  
2. Validación falla → se conservan IDs locales, subtotal no confirmado.  
3. Concurrencia de stock: último en checkout futuro gana (sin reserva ahora).  
4. Productos sin variantes activas no son vendibles en Etapa 04.  
5. Extracción a paquete aún no realizada.
