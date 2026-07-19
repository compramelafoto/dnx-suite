# Clickatón — 10D3C — Interfaz administrativa de productos y variantes

**Estado:** UI productiva de productos/variantes sobre el backend 10D3B.  
**Fuera de alcance:** entradas, composición de kits, inscripción pública, pagos, QR, check-in, venue admin, cambios Prisma/Neon.

## 1. Rutas

| Ruta | Estado |
| ---- | ------ |
| `/admin/catalogo` | Hub operativo |
| `/admin/catalogo/productos` | Lista + filtros |
| `/admin/catalogo/productos/nuevo` | Alta |
| `/admin/catalogo/productos/[productId]` | Detalle, edición, variantes, stock |
| Entradas / disponibilidad / operación kits | Solo “Próximamente” (sin enlace roto) |

## 2. Navegación

Ítem **Catálogo** en `config/admin/navigation.ts` (`adminRoutes.catalog`), icono `catalog`, activo con `isAdminNavActive`.

## 3. Páginas

- Hub: cards Disponible / Próximamente.
- Lista: filtros GET (`editionId`, `active`, `q`, `stock`, `variants`).
- Nuevo: formulario producto → redirect a detalle.
- Detalle: datos editables + panel de variantes.

Arquitectura:

```text
Server Component → server action delgada → createCatalogService → casos de uso → repo Prisma
```

## 4. Actions

Ubicación: `lib/admin-catalog/actions/products.ts` (+ `product-forms.ts` con redirect).

| Action | Caso de uso | Permiso (vía service) | Revalidación |
| ------ | ----------- | --------------------- | ------------ |
| `listProductsAction` | `listProducts` | `catalog.read` | — |
| `getProductAction` | `getProduct` | `catalog.read` | — |
| `createProductAction` | `createProduct` | `catalog.product.mutate` | hub, listado, detalle |
| `updateProductAction` | `updateProduct` | `catalog.product.mutate` | idem |
| `setProductActiveAction` | `setProductActive` | `catalog.activate` | idem |
| `createVariantAction` | `createProductVariant` | `catalog.variant.mutate` | idem |
| `updateVariantAction` | `updateProductVariant` | `catalog.variant.mutate` | idem |
| `setVariantActiveAction` | `setVariantActive` | `catalog.activate` | idem |
| `adjustVariantStockAction` | `adjustVariantStock` | `catalog.variant.mutate` | idem |

Cada action: resuelve actor (`getClickatonAuthUser` + allowlist/SUPER_ADMIN), llama al service, serializa errores con `toSerializableCatalogError`, no expone Prisma.

## 5. Formularios

Patrones existentes: `AdminForm`, `Field`, `Button`, `AdminFlashMessage`, `useActionState`.  
Errores por campo + mensaje general; valores rehidratados en `state.values`; botón `loading`/`disabled` durante envío.

## 6. Productos

Campos: edición, nombre, descripción, código, activo (alta).  
Edición bloqueada en edición. Código normalizado y único por edición (backend). Soft activate/deactivate con confirmación explícita (no “Eliminar”).

## 7. Variantes

Campos alta: nombre, código, SKU, stock inicial, precio opcional (pesos), moneda, activo.  
Edición: sin stock libre; stock solo vía “Ajustar stock”.  
Nombres genéricos (talle, botella, diploma, digital, etc.).

## 8. Stock

Modalidad UI: **establecer total** (`newStock`) o **delta**. Motivo obligatorio.  
Advertencia al reducir; bloqueo UI + backend si `newStock < reservedStock`.  
`reservedStock` no editable. Fórmula MVP: `disponible = stock - reservedStock`.

## 9. Precios

| Entrada UI | Storage (minor units) | Display |
| ---------- | --------------------- | ------- |
| `40000` (pesos enteros) | `4_000_000` | `$ 40.000 ARS` |
| vacío | `null` | Sin precio adicional |
| `0` | `0` | Incluido / sin adicional |

Conversión: `lib/admin-catalog/ui/money-ui.ts` (`pesosInputToMinorUnits` = pesos × 100). Sin floats. MVP ARS, pesos enteros (separador de miles opcional).

## 10. Estados

Lista: sin ediciones, sin productos, filtros vacíos, inactivos, sin variantes, agotado (vía filtros/badges).  
Variante: disponible / poco stock (≤ **5**, `LOW_STOCK_THRESHOLD`) / agotado / inactiva — no solo por color (`Badge` + texto).

## 11. Permisos

Layout `requireClickatonAdmin` + autorización en cada action/service. Sin venue admin.

## 12. Accesibilidad

Labels/`Field` con `aria-describedby`; alertas `role="alert"`; confirmaciones con texto; tablas con scroll horizontal; botones con texto visible.

## 13. Responsive

Filtros en grid; tabla con `overflow-x-auto`; formularios apilables.

## 14. Tests

`pnpm --filter clickaton selfcheck:admin-catalog-products-ui`  
Cubre rutas, nav, ausencia de Prisma en client, actions (auth, CRUD, SKU/código, stock), conversión de precios, sin hard delete. In-memory; sin Neon.

## 15. Riesgos

- `revalidatePath` fuera de request Next se ignora (selfcheck); en app real funciona.
- Overrides de test vía `globalThis` por posibles copias de módulo `"use server"`.
- Lista requiere `editionId` (default: primera edición).

## 16. Decisiones diferidas

- UI de entradas/kits (10D3D).
- Modal focus-trap dedicado (confirmación vía `window.confirm` como sedes).
- Umbral “poco stock” configurable por edición.
- Atajo desde detalle de edición (ruta preparada: `catalogAdminRoutes.editionCatalog`).

## 17. Próximo paso

**10D3D — Interfaz administrativa de entradas y composición de kits.**

## Selfchecks relacionados

```sh
pnpm --filter clickaton selfcheck:admin-catalog-design
pnpm --filter clickaton selfcheck:admin-catalog-domain
pnpm --filter clickaton selfcheck:admin-catalog-prisma
pnpm --filter clickaton selfcheck:admin-catalog-products-ui
```
