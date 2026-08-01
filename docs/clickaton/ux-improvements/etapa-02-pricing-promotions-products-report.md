# Etapa 02 Imp. 07 — Precios, promociones, productos y kits

**Estado:** DONE (con riesgos comerciales documentados)  
**Fecha:** 2026-08-01  
**Alcance:** presentación y UX de fases de precio, códigos promocionales y catálogo (productos/talles).  
**No modificado:** Prisma, migraciones, APIs, rutas, permisos, cálculos de precio, selección de fase, descuentos, redenciones, stock, variantes persistidas, checkout de pago, Mercado Pago, producción.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/ediciones/[editionId]/precios` | Título “Fases de precio”, resumen precio actual + próximo tachado, solapes, tabla/cards, confirms, técnico |
| `/admin/promociones` | “Códigos promocionales”, estados/usos/descuento humanos, confirms, técnico |
| `/admin/catalogo` | Copy “Productos y kits”, sin promesa falsa de tienda |
| `/admin/catalogo/productos` | Cards mobile, SKU fuera de búsqueda principal |
| Detalle producto / variantes (componentes) | Labels humanos de talles, SKU como código interno |
| Wizard público (presentación) | Precio actual + próximo tachado si es más caro (`nextPricePhase` ya resuelto) |

Sin cambios de path ni query contracts obligatorios.

---

## Componentes modificados

- `app/admin/(panel)/ediciones/[editionId]/precios/page.tsx`
- `app/admin/(panel)/promociones/page.tsx`
- `app/admin/(panel)/catalogo/page.tsx`
- `app/admin/(panel)/catalogo/productos/page.tsx`
- `components/admin/pricing/PricePhaseForm.tsx`
- `components/admin/catalog/ProductForm.tsx`
- `components/admin/catalog/VariantForm.tsx`
- `components/admin/catalog/ProductVariantsPanel.tsx`
- `components/admin/catalog/TicketCompositionPanel.tsx`
- `components/public-registration/PublicRegistrationWizard.tsx`
- `lib/public-registration/domain/types.ts` / `public-registration-service.ts` (solo exposición de `nextPricePhase` ya calculado)
- `package.json` (`test:commercial-ux`)

---

## Componentes creados

| Pieza | Rol |
|---|---|
| `lib/admin/pricing/ui/commercial-status-presentation.ts` | Estados fase/promo/producto, precio compare, usos, errores promo |
| `components/pricing/PricePhaseCompare.tsx` | Precio actual + próximo tachado |
| `lib/admin/pricing/ui/commercial-status-presentation.test.ts` | Tests presentación + contratos UI |
| Docs: `etapa-02-pricing-before-after.md`, `commercial-status-map.md`, `commercial-sensitive-actions.md` | Mapas UX |

---

## Precio actual y próxima fase

- Admin: `getEditionPriceSnapshot` → `presentPriceCompare` → `PricePhaseCompare`.
- Si `next.amount > current.amount`: próximo precio con `line-through` + helper promocional.
- Público: wizard muestra el mismo patrón con `context.nextPricePhase` (sin recalcular).
- No se inventan transiciones: solo se muestra lo que el resolver ya entrega.

---

## Vigencias y fechas

- Formato `es-AR` vía `formatCommercialDateTime`.
- Etiquetas: Comienza / Finaliza / vigente hasta / Próximo cambio.
- Aclaración de timezone de edición en precios.
- Solapes: mensaje humano + lista de fases (usa `findActivePhaseOverlaps` existente).

---

## Promociones

- Código visible como protagonista; ID en `AdminTechnicalInfo`.
- Descuento: “X % de descuento” / “$… de descuento” (no `PERCENTAGE`/`WRAPPED`/`FIXED` crudo en UI).
- Usos: “N de M usos utilizados” / “Sin límite de usos configurado” (null ≠ inventar ilimitado sin dato).
- Acciones: Crear código / Desactivar código / Volver a habilitar + confirm.

---

## Productos, talles e imágenes

- Catálogo: “Productos y kits”; variantes → “Talles y opciones”.
- SKU etiquetado “Código interno (SKU)” y fuera de columnas principales de composición.
- Store status DRAFT → “En preparación”; ACTIVE → “Disponible para venta separada” (sin tienda pública falsa).
- Incluidos por fase: nombres desde `displayTitle \|\| product.name` en listado de fases.

---

## Estrategia responsive

- Precios: tabla `md+`; cards en mobile.
- Promociones: lista de cards (una columna en mobile).
- Productos: `AdminDataTable` + `mobileCard`.
- Controles `min-h-11`; técnico colapsado; sin scroll horizontal obligatorio como única vía.

---

## Información técnica reubicada

`AdminTechnicalInfo` (cerrado por defecto) en fases y promociones: IDs, tipos internos, fechas ISO, currency raw, límites.

---

## Acciones sensibles

Ver `commercial-sensitive-actions.md`. Confirms en habilitar/desactivar fase y desactivar/habilitar código.

---

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run test:commercial-ux` | PASS (11) |
| `npm run selfcheck:price-phases` | PASS |
| `npm run selfcheck:price-phase-products` | PASS |
| ESLint archivos modificados | PASS |
| `tsc --noEmit` | PASS en archivos de esta etapa; errores previos ajenos en `resend-webhook/readiness.test.ts` (posiblemente `undefined`) no bloquean build |
| `npm run build` | PASS |
| E2E | No ejecutados (sin entorno E2E dedicado en esta entrega) |

---

## Validación por resolución (estructural)

| Viewport | Criterio | Resultado |
|---|---|---|
| 320×568 | Una columna, precio al inicio, cards, sin tabla única | OK estructural (markup) |
| 360×800 | Idem | OK estructural |
| 390×844 | Idem | OK estructural |
| 430×932 | Idem | OK estructural |
| Desktop | Tabla fases + compare + técnico | OK estructural |

No se alteraron precios/productos reales en producción.

---

## Fallas previas ajenas

- Posible `ENOSPC` / disco lleno en builds locales (documentado en Imp. 06).
- Panel jurado sigue fuera de Clickatón (FotoRank) — fuera de alcance.

---

## Riesgos pendientes

- Superposiciones/huecos: validación de solape mostrada; huecos temporales no bloquean UI si el dominio no los valida.
- Venta separada: estado de tienda existe; tienda pública no.
- Confirmaciones no sustituyen auditoría comercial formal.
- Errores promocionales públicos: capa `presentPromotionError` lista; wiring en todos los flujos checkout depende de superficie existente.

---

## `COMMERCIAL_REVIEW`

Ver sección final de `commercial-sensitive-actions.md` y `commercial-status-map.md`.
