# Clickatón — 10D3D — UI administrativa de entradas y composición de kits

**Estado:** UI productiva de tipos de entrada + composición sobre backend 10D3B.  
**Fuera de alcance:** checkout, inscripción pública, pagos, órdenes, reservas transaccionales de stock, fulfillment.

## Objetivo

Administrar tipos de entrada (precio, cupo, período, activación) y la composición comercial de kits (productos/variantes incluidos) sin tocar Prisma ni Neon.

## Arquitectura

```text
Server Component → server action delgada → createCatalogService → caso de uso → repo Prisma
```

Patrones reutilizados de 10D3C: `runtime` (globalThis test overrides), `action-result`, `money-ui`, soft activate, flash messages, `AdminForm`/`Field`.

**Diferencia diseño 10D3A vs backend:** la composición se muta solo con `replaceTicketTypeItems` (replace-all). Las actions `add/update/remove` reconstruyen el array y llaman a ese caso de uso. No hay mutación parcial en el dominio.

## Rutas

| Ruta | Rol |
| ---- | --- |
| `/admin/catalogo` | Hub (entradas Disponible + contadores) |
| `/admin/catalogo/entradas` | Lista + filtros |
| `/admin/catalogo/entradas/nueva` | Alta |
| `/admin/catalogo/entradas/[ticketTypeId]` | Detalle, edición, composición |

Identificador URL = `ticketTypeId` (`ClickatonTicketType.id`).

## Pantallas / filtros / formularios

- Lista: nombre, código, precio, cupo/usados/disponible (vía `getCatalogAvailability`), período, kit kind, estados comerciales, acciones.
- Filtros query: `editionId`, `active`, `q`, `capacity`, `products`, `sale`, `config` (UI post-filtro donde el backend no filtra).
- Alta/edición: edición, nombre, descripción, código, precio pesos, cupo o ilimitado, hold, fechas `datetime-local`, activo.
- Detalle: resumen cupo/precio/período/configuración + form + panel composición.

## Composición / producto vs variante

- Un producto por entrada (unicidad por `productId` en parser).
- Variante fija opcional, o `requiresVariantChoice` (sin `productVariantId`).
- Producto sin variantes: solo `productId`.
- Producto con variantes: UI recomienda variante fija o selección; backend no exige variante si `requiresVariantChoice=false`.
- Agregar producto **inactivo** es error bloqueante del repo; si se desactiva después, la UI muestra advertencia en evaluación de configuración.
- **No se modifica `stock` ni `reservedStock`** al componer.

## Precios

Misma conversión 10D3C: pesos enteros × 100 → minor units. Display entrada: `$ 40.000 ARS` o **Gratis** si 0 (`displayTicketPrice`).

## Cupos y disponibilidad

- Cupo de entrada (`capacity` / null = ilimitado) ≠ stock de productos.
- Usados = `confirmedCount + activeHoldCount` (si hay datos; sin órdenes reales suele ser 0).
- Disponible = fórmula 10D3B (`capacity - confirmed - holds`).

## Períodos

- Persistencia: `Date` ISO vía `new Date(datetime-local)`.
- UI: `datetime-local` en hora local del navegador; display `es-AR`.
- Estados: venta futura / en venta / finalizada / sin período / inactiva (`salesStatusOf`).

## Estado de configuración

`evaluateTicketConfiguration` en `ui/ticket-status.ts`:

- **Completa** / **Incompleta** / **Con advertencias**.
- No exige productos (entrada simple válida).
- Kit kind: Entrada / Entrada + producto / Kit (mismo modelo `TicketType`).

## Permisos

`requireClickatonAdmin` en páginas; actor + capabilities en cada action (`catalog.read`, `catalog.ticket.mutate`, `catalog.activate`, `catalog.composition.mutate`). Sin venue admin.

## Errores

`toSerializableCatalogError`: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, DUPLICATE_CODE, VALIDATION, EDITION_MISMATCH, IMMUTABLE_FIELD, etc. Sin Prisma/SQL al usuario.

Códigos pedidos como `INVALID_PRICE` se mapean a `VALIDATION` del dominio existente (no se inventó un código paralelo).

## Accesibilidad / responsive

Field + aria-describedby; role=alert/status; badges con texto; tablas con scroll horizontal; filtros apilables.

## Selfcheck

```sh
pnpm --filter clickaton selfcheck:admin-catalog-tickets-ui
```

Script: `apps/clickaton/scripts/admin-catalog-tickets-ui.selfcheck.ts` (in-memory).

## Auditoría de imports (Client)

Verificado en selfcheck: `TicketTypeForm`, `TicketCompositionPanel`, `TicketActiveToggle` no importan Prisma, `@repo/db`, `createCatalogService` ni repo Prisma. Sin hard delete. Sin mutaciones GET.

## Riesgos

- Hub recorre todas las ediciones (N queries) — OK MVP.
- Productos inactivos en composición existente: replace puede fallar hasta corregir.
- Fechas dependen del timezone del navegador del admin.

## Decisiones diferidas

- Vista dedicada “Disponibilidad y cupos”.
- Duplicar entrada desde UI.
- Órdenes/inscripciones (10D3E).
- Reserva transaccional de stock.

## Próximo paso

**10D3E — Interfaz administrativa de órdenes e inscripciones.**
