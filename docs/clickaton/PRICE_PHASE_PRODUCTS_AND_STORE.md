# Etapa 8B — Productos por fase de precio y tienda Clickatón

## Resumen

Los artículos promocionales incluidos (remera, botella, kit, etc.) **ya no dependen del ticket `GENERAL`**. La fuente de verdad comercial es `ClickatonPricePhaseItem` por fase de precio. El mismo `ClickatonProduct` se reutiliza para una futura tienda pública (sin storefront habilitado en esta etapa).

## Auditoría (comportamiento anterior)

| Relación | Antes | Ahora |
|----------|-------|-------|
| Ticket → producto | `ClickatonTicketTypeItem` en GENERAL incluía Remera → **todas las fases** heredaban merch | Ticket base = acceso / componentes permanentes |
| Fase → precio | `ClickatonRegistrationPricePhase` solo monto/fechas | Fase también define `includedItems` |
| Reserva | `buildItemsFromTicket(ticket.products)` | Ticket base + items de fase vigente → snapshots |
| Stock | `reservedStock` + `ClickatonStockHold` | Igual + ledger `ClickatonInventoryMovement` |
| Imágenes | No había media de producto | `primaryImageAssetId` / `ClickatonProductMedia` + `DnxMediaAsset` |

**Migración Remera Argentina 2026:** el seed elimina el `TicketTypeItem` de Remera en GENERAL y crea `PricePhaseItem` solo en fases cuyo monto es $25.000 (Fase 1). Fase 2 queda configurable en admin (no se asume). Fase 3 no incluye remera inicialmente. Los `RegistrationItem` históricos no se tocan.

## Dos niveles de items

### A. Ticket base (`ClickatonTicketTypeItem`)

Componentes que siempre pertenecen al tipo de entrada (acceso, acreditación, etc.). Pueden no requerir fulfillment físico.

### B. Fase (`ClickatonPricePhaseItem`)

Beneficios comerciales por fecha/cupo (remera, merch sponsor, etc.).

### Política de duplicados

**Bloquear** el mismo `productId` en ticket base y fase. No se suman cantidades. Validado en `resolveIncludedProducts` y en admin.

## Resolución en inscripción

1. Resolver edición y ventana  
2. Resolver fase vigente (`resolveCurrentPricePhase`)  
3. Resolver tipo de entrada  
4. Items base del ticket  
5. Items de la fase  
6. Validar stock / variantes  
7. Crear holds + snapshots  
8. El cliente solo envía `variantChoices` de productos **ya resueltos**; se rechazan productIds ajenos  

## Snapshots (`ClickatonRegistrationItem`)

Campos clave: `sourceType` (`TICKET_BASE` | `PRICE_PHASE` | `STORE_PURCHASE`), `pricePhaseItemId`, `ticketTypeItemId`, `productNameSnapshot`, `productDescriptionSnapshot`, `imageAssetIdSnapshot`, `sizeChartAssetIdSnapshot`, `isIncluded`, `unitPriceAmount = 0` para incluidos.

No se recalcula el beneficio leyendo la fase viva después del pago.

## Imágenes y cuadro de talles

- Soft refs a `DnxMediaAsset` (`PRODUCT_IMAGE`, `PRODUCT_SIZE_CHART`)  
- `ClickatonProductMedia` para galería ordenada  
- Wizard: sección «Tu inscripción incluye» + modal «Ver cuadro de talles» sin abandonar el flujo  

## Stock compartido

Fuente operativa: `ClickatonProductVariant.stock` / `reservedStock` + holds.  
Ledger: `ClickatonInventoryMovement` con idempotencyKey (`reg:{id}:var:{id}:hold|confirm|release`, `store:{order}:…`).

Inscripción y tienda futura consumen el mismo inventario. Holds de inscripción no son vendibles en tienda.

## Fulfillment

Estados: `PENDING` | `READY` | `DELIVERED` | `CANCELLED` | `RETURNED`.  
Panel distingue origen vía `sourceType` (incluido vs tienda vs futuro regalo).

## Preparación tienda (sin storefront)

Campos en `ClickatonProduct`: `isStoreEnabled`, `storeStatus`, `storeSlug`, `storeTitle`, `storeDescription`, `storePrice`, `compareAtPrice`, envío/pickup, etc.

Rutas futuras (no implementadas): `/tienda`, `/tienda/[slug]`, `/carrito`, `/checkout`, `/mi-cuenta/compras`.

Órdenes de tienda serán **separadas** de órdenes de inscripción (DNX Payments + `@repo/promotions` + allocations propias).

## DNX Payments y promociones

- Inscripción: flujo actual de checkout / promo sobre monto de fase.  
- Tienda: orden distinta, idempotencia propia, allocations configurables.  
- No mezclar carritos salvo decisión explícita futura.

## Admin

- `/admin/ediciones/[id]/precios`: productos por fase, duplicar desde otra fase, alertas.  
- Catálogo de productos: prep tienda + asset IDs de imagen/cuadro de talles.  

## Tests

```bash
pnpm --filter clickaton selfcheck:price-phase-products
pnpm --filter clickaton selfcheck:price-phases
pnpm --filter clickaton selfcheck:included-merch-variants
pnpm --filter clickaton selfcheck:public-registration-reservation
```

## Fuera de alcance (OK)

Storefront público, carrito, envíos, checkout de tienda, publicación comercial.

## Criterio de cierre

- Cada fase define sus productos  
- Una fase puede no incluir remera  
- Talle solo si corresponde  
- Snapshots históricos estables  
- Catálogo único (sin duplicar Remera incluida / Remera tienda)  
- Inscripciones comerciales siguen OFF hasta confirmación visual  
