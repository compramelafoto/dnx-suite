# Stock de insumos — Etapa 1 (insumos, recetas y consumo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar de alta insumos (ribbon/kit Kodak, sobres, tinta), definir cuánto gasta cada producto vendido y descontarlo solo al vender y al tomar un pedido con seña, devolviéndolo al anular o cancelar.

**Architecture:** Un insumo es un `Product` con `kind = "INSUMO"` (texto, sin columnas nuevas en `Product`) más una fila en la tabla nueva `FotofficeInsumo`. Las recetas viven en `FotofficeRecetaInsumo`. Un módulo puro (`lib/stock/consumo.ts`) expande líneas vendidas → cantidades por insumo (desarmando combos); un módulo de servidor (`lib/stock/consumo-servidor.ts`) planifica antes del bloqueo de filas y escribe/revierte movimientos `CONSUMO` con `applyStockMovement`. Se engancha en `recordSale`, `void-sale` y `apartarStock`/`devolverStockApartado` de Pedidos.

**Tech Stack:** Next.js (App Router, server actions), Prisma (schema compartido en `packages/db`), Postgres Neon, Vitest. Leer `apps/fotoffice/AGENTS.md`: "This is NOT the Next.js you know" — consultar `node_modules/next/dist/docs/` antes de escribir páginas/acciones.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-stock-insumos-recepcion-e-importacion-design.md` (§4 completo, §8 guías 1, 2 y 5, §9 etapa 1, §11 decisiones).

**Worktree / rama:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-fo-stock-insumos`, rama `docs/fotoffice-stock-insumos` (la implementación puede ir en esta misma rama o en `feat/fotoffice-stock-insumos-etapa-1` creada desde ella).

## Global Constraints

- **Ninguna columna nueva en tablas compartidas** (`Product`, `StockMovement`, `Sale`, `SaleItem`): solo tablas nuevas `Fotoffice*`. Valores nuevos (`INSUMO`, `CONSUMO`) son texto; no hay CHECK en SQL sobre `Product.kind` ni `StockMovement.reason` (verificado).
- Sin enums de Prisma (ver comentario de `lib/sales/constants.ts`).
- Migración idempotente (`IF NOT EXISTS`), nombre `20261203120000_fotoffice_stock_insumos` (posterior a la última de main, `20261202120000_fotoffice_digitalizacion_titulo`). Se aplica **a mano** en la base de FOTOFFICE (Neon `divine-hall-10689679`, rama `development`) y se registra en `_prisma_migrations` con el checksum SHA-256 del archivo, **antes del merge**. El deploy nunca corre `migrate deploy`. Las otras bases no la necesitan (ninguna otra app consulta tablas `Fotoffice*`), pero se deja dicho en el PR.
- Toda escritura de stock pasa por `applyStockMovement` (`lib/sales/variant-stock.ts`) y bloquea filas antes con `lockStockRows` (`lib/sales/stock-lock.ts`) en **una sola llamada** que incluya productos vendidos **y** insumos.
- Vender nunca se bloquea por falta de stock: el insumo puede quedar negativo.
- Nota de los movimientos de consumo: exactamente `consumo:item:<id>` (en CONSUMO y en su DEVOLUCION). Nunca `item:<id>` (lo usa Pedidos para emparejar sus devoluciones).
- `sourceModule`: `"sales"` en ventas (sourceRef = saleId), `"pedidos"` en pedidos (sourceRef = pedidoId).
- Cantidades enteras. Receta `quantity` Int > 0 y `porCada` Int ≥ 1 (default 1). Consumo por renglón = `ceil(qty / porCada) × quantity` — redondeo para arriba por renglón, decidido por Daniel (las piezas de distintos clientes no se juntan en una hoja).
- Kodak 305: consumo por hoja `10x15 = 1`, `13x18 = 2`, `15x20 = 2`; insumo "Kit Kodak 305 (copias 10x15)", unidad "copias 10x15", unidad de compra "Kit 305 6R", `unidadesPorCompra = 640`; existencia inicial **0**.
- Textos de pantalla en español rioplatense llano ("vos"), sin tecnicismos. Montos en pesos.
- FOTOFFICE no tiene staging: nada de scripts que escriban en producción; la carga Kodak es un botón idempotente que usa el propio negocio.
- Antes de commitear: `pnpm --filter fotoffice typecheck` y `pnpm --filter fotoffice test` (ver memoria: el typecheck puede morir por memoria y devolver éxito — revisar que la salida termine sin "heap out of memory").

## Review Focus

1. **Insumo colado en el Cobrador por el lector de códigos**: escanear el código de barras del kit Kodak en el Mostrador no debe agregarlo al ticket → test en Task 4 (`findProductByCode` excluye INSUMO).
2. **Anular una venta después de cambiar la receta**: debe devolver lo descontado entonces, no lo que dice la receta hoy → test en Task 6.
3. **Cancelar un pedido con una línea entregada y otra no**: solo vuelve el insumo de la no entregada, y la devolución de stock del producto (nota `item:`) sigue funcionando → test en Task 7.
4. **Combo que contiene otro combo con receta propia** (y combo cuyo componente es un servicio sin stock): se suma todo, multiplicado por cantidades → test en Task 2.
5. **Producto cuya receta apunta a algo que dejó de ser insumo o fue desactivado**: no rompe la venta; se descuenta igual si sigue siendo `INSUMO`, se ignora si ya no lo es → test en Task 3.

---

### Task 1: Esquema, migración y constantes

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos nuevos junto a `FotofficeProductoCatalogo`; relaciones inversas en `Product`, `Workspace`, `FotofficeSalidaImpresion`, `FotofficeTamanoImpresion`)
- Create: `packages/db/prisma/migrations/20261203120000_fotoffice_stock_insumos/migration.sql`
- Modify: `apps/fotoffice/lib/sales/constants.ts`
- Test: `apps/fotoffice/lib/sales/constants.test.ts`

**Interfaces:**
- Produces:
  - `PRODUCT_KINDS = ["PRODUCTO", "SERVICIO", "INSUMO"]`, `PRODUCT_KIND_LABELS.INSUMO = "Insumo"`
  - `STOCK_REASONS` + `"CONSUMO"`, `STOCK_REASON_LABELS.CONSUMO = "Consumo"`
  - Prisma: `fotofficeInsumo`, `fotofficeRecetaInsumo`, `fotofficeConsumoTamano`

Modelos (campos exactos):
- `FotofficeInsumo`: `id` cuid, `workspaceId`, `productId @unique`, `unidad String`, `unidadCompra String?`, `unidadesPorCompra Int?`, `createdAt`, `updatedAt`; FK a `Product` y `Workspace` con `onDelete: Cascade`; `@@index([workspaceId])`.
- `FotofficeRecetaInsumo`: `id`, `workspaceId`, `productId`, `insumoId`, `quantity Int`, `porCada Int @default(1)`, `order Int @default(0)`, `createdAt`, `updatedAt`; FK `product` (relación `"FotofficeRecetaProducto"`, Cascade) e `insumo` (relación `"FotofficeRecetaInsumo"`, **Restrict**: no se borra un insumo usado en recetas); `@@unique([productId, insumoId])`, `@@index([workspaceId, insumoId])`. SQL: `CHECK ("quantity" > 0)`, `CHECK ("porCada" >= 1)` y `CHECK ("productId" <> "insumoId")`.
- `FotofficeConsumoTamano`: `id`, `workspaceId`, `salidaId`, `tamanoId`, `insumoId`, `quantity Int`, `createdAt`, `updatedAt`; FKs Cascade (insumo Restrict); `@@unique([salidaId, tamanoId, insumoId])`; `CHECK ("quantity" > 0)`.

- [ ] **Step 1:** En `constants.test.ts` agregar: `expect(PRODUCT_KINDS).toContain("INSUMO")`, `expect(PRODUCT_KIND_LABELS.INSUMO).toBe("Insumo")`, `expect(STOCK_REASONS).toContain("CONSUMO")`, `expect(STOCK_REASON_LABELS.CONSUMO).toBe("Consumo")`.
- [ ] **Step 2:** Run `pnpm --filter fotoffice test lib/sales/constants.test.ts` → FAIL.
- [ ] **Step 3:** Actualizar constantes; agregar los tres modelos al schema; escribir `migration.sql` idempotente (encabezado comentado en español como `20261129120000_fotoffice_sena_para_retirar`), con `CREATE TABLE IF NOT EXISTS`, FKs dentro de bloques `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) $$`, índices `IF NOT EXISTS`. Correr `pnpm --filter @repo/db exec prisma generate`.
- [ ] **Step 4:** Revisar todos los `switch`/`Record<ProductKind,…>`/`Record<StockReason,…>` que ahora no compilan: `pnpm --filter fotoffice typecheck` → sin errores. Donde un listado muestra el tipo, INSUMO se muestra con su etiqueta.
- [ ] **Step 5:** Test → PASS. Commit `Agregar insumos, recetas y consumo por tamaño al esquema de FOTOFFICE`.

### Task 2: Expansión pura del consumo

**Files:**
- Create: `apps/fotoffice/lib/stock/consumo.ts`
- Test: `apps/fotoffice/lib/stock/consumo.test.ts`

**Interfaces:**
- Produces:
```ts
export type LineaVendida = { ref: string; productId: string | null; qty: number };
export type Receta = { productId: string; insumoId: string; quantity: number; porCada: number };
export type ComponenteCombo = { comboProductId: string; componentProductId: string; quantity: number };
export type ConsumoLinea = { ref: string; insumoId: string; qty: number }; // qty > 0, a restar
export function expandirConsumo(
  lineas: readonly LineaVendida[],
  recetas: readonly Receta[],
  combos: readonly ComponenteCombo[],
  insumosValidos: ReadonlySet<string>,
): ConsumoLinea[];
```
Reglas: por línea, receta propia del producto + (si es combo) recetas de componentes recursivamente; las unidades de cada producto son `qty` de la línea × cantidades del combo; cada receta aporta `ceil(unidades / porCada) × quantity` (redondeo por producto dentro de la línea); agrupa por (`ref`, `insumoId`) sumando; ignora insumos que no estén en `insumosValidos`; corta recursión a profundidad 10 (defensa contra ciclos aunque `combos.ts` los impide); líneas sin producto o con `qty <= 0` no consumen; orden de salida estable (por `ref`, luego `insumoId`).

- [ ] **Step 1: Tests** (`describe("expandirConsumo")`):
  - `"foto carnet gasta 1 copia y 1 sobre por unidad"`: línea `{ref:"a",productId:"carnet",qty:3}`, recetas carnet→kit 1, carnet→sobre 1 ⇒ `[{ref:"a",insumoId:"kit",qty:3},{ref:"a",insumoId:"sobre",qty:3}]`.
  - `"15x20 gasta 2 copias"`: qty 4 ⇒ kit 8.
  - `"combo desarma componentes con cantidades y suma su receta propia"`: combo C = 2×P15x20 + 1×carnet, receta propia C→bolsa 1, venta qty 2 ⇒ kit `2*(2*2 + 1*1)=10`, sobre 2, bolsa 2.
  - `"combo dentro de combo"`: C1 contiene 3×C2, C2 contiene 1×P10x15 (receta kit 1); qty 1 ⇒ kit 3.
  - `"servicio sin stock con receta igual consume"` (el puro no mira `tracksStock`): ⇒ consume.
  - `"ignora insumos que ya no son válidos"`: receta a `"viejo"` fuera de `insumosValidos` ⇒ no aparece.
  - `"renglón suelto sin producto no consume"` ⇒ `[]`.
  - `"3 polaroid 7,5x10 gastan 2 copias"`: receta `{quantity:1, porCada:2}`, qty 3 ⇒ kit 2; qty 2 ⇒ 1; qty 1 ⇒ 1.
  - `"polaroid 9x13 gasta 2 copias por hoja de 2"`: receta `{quantity:2, porCada:2}`, qty 3 ⇒ kit 4.
  - `"combo redondea por componente"`: combo = 3×Polaroid7,5x10 (receta 1 cada 2), qty 1 ⇒ kit 2.
  - `"ciclo no cuelga"`: combos A→B, B→A con recetas ⇒ termina y devuelve un resultado finito.
- [ ] **Step 2:** `pnpm --filter fotoffice test lib/stock/consumo.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `expandirConsumo` (módulo PURO: sin imports de `@repo/db`).
- [ ] **Step 4:** → PASS. Commit `Calcular el consumo de insumos de una venta`.

### Task 3: Planificar, aplicar y revertir consumo en la base

**Files:**
- Create: `apps/fotoffice/lib/stock/consumo-servidor.ts`
- Test: `apps/fotoffice/lib/stock/consumo-servidor.test.ts` (tx falso en memoria, molde de `lib/sales/record-sale.test.ts`)

**Interfaces:**
- Consumes: `expandirConsumo` (Task 2), `applyStockMovement`, `Tx` = `Prisma.TransactionClient | PrismaClient`.
- Produces:
```ts
export type PlanConsumo = { insumoIds: string[]; consumos: ConsumoLinea[] };
/** Solo lecturas (recetas, combos, insumos vigentes). Se llama ANTES de lockStockRows. */
export async function planificarConsumo(tx: Tx, workspaceId: string, lineas: readonly LineaVendida[]): Promise<PlanConsumo>;
/** Escribe un CONSUMO por (ref, insumo): qty negativa, note `consumo:item:<ref>`. Requiere filas ya bloqueadas. */
export async function aplicarConsumo(tx: Tx, d: { workspaceId: string; plan: PlanConsumo; sourceModule: "sales" | "pedidos"; sourceRef: string; createdByUserId: number | null }): Promise<void>;
/** Lee los CONSUMO de esa fuente (y sus DEVOLUCION con nota `consumo:item:`), devuelve lo pendiente. Solo lectura. */
export async function consumosPendientesDeDevolver(tx: Tx, d: { workspaceId: string; sourceModule: "sales" | "pedidos"; sourceRef: string; refs: ReadonlySet<string> | null }): Promise<{ insumoId: string; qty: number; note: string }[]>;
/** Escribe la DEVOLUCION de cada pendiente (qty positiva, misma note). Requiere filas ya bloqueadas. */
export async function devolverConsumos(tx: Tx, d: { workspaceId: string; pendientes: readonly { insumoId: string; qty: number; note: string }[]; sourceModule: "sales" | "pedidos"; sourceRef: string; createdByUserId: number | null }): Promise<void>;
```
`planificarConsumo`: lee `FotofficeRecetaInsumo` de los productos de las líneas y de todos los componentes de combos alcanzables (lee `FotofficeComboItem` en anchura hasta no encontrar combos nuevos, máximo 10 vueltas), y `insumosValidos` = productos `kind = "INSUMO"` del workspace entre los insumos de esas recetas (activos o no: un insumo desactivado se sigue descontando). Siempre filtra por `workspaceId`.

- [ ] **Step 1: Tests:**
  - `"aplica un CONSUMO por insumo con nota consumo:item"`: verifica llamadas a `stockMovement.create` con `reason:"CONSUMO"`, `qty:-3`, `note:"consumo:item:a"`, `sourceModule:"sales"`.
  - `"receta a un producto que ya no es insumo se ignora"` (Review Focus 5).
  - `"pendientes descuenta lo ya devuelto"`: CONSUMO kit -6 nota `consumo:item:a` + DEVOLUCION +6 misma nota ⇒ `[]`; sin devolución ⇒ `[{insumoId:"kit",qty:6,note:"consumo:item:a"}]`.
  - `"pendientes filtra por refs"`: refs `{"b"}` ⇒ solo los de `consumo:item:b`.
  - `"no devuelve PEDIDO ni ENTRADA"`: movimientos de otro motivo con la misma fuente no aparecen.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS. Commit `Escribir y revertir el consumo de insumos`.

### Task 4: Que un insumo nunca se venda

**Files:**
- Create: `apps/fotoffice/lib/sales/vendible.ts` — `export const NO_ES_INSUMO: Prisma.ProductWhereInput = { kind: { not: "INSUMO" } };` y `export function esVendible(kind: string): boolean`.
- Modify: `apps/fotoffice/lib/sales/repository.ts` (`VISIBLE_EN_MOSTRADOR` pasa a `AND: [NO_ES_INSUMO, {OR: …}]`; `findProductByCode` también en la búsqueda por talle)
- Modify: `apps/fotoffice/lib/catalogo/combos.ts` (`productosParaCombo` excluye INSUMO; `guardarComponentes` rechaza componentes INSUMO con "Un insumo no se puede vender dentro de un combo.")
- Modify: `apps/fotoffice/lib/presupuestos/editor-datos.ts`, `lib/presupuestos/lista-precios.ts`, `lib/presupuestos/items-de-la-propuesta.ts` (excluir INSUMO de lo ofrecible)
- Modify: `apps/fotoffice/app/(shell)/ventas/actions.ts` (checkout: si una línea del ticket trae un `productId` INSUMO, rechazar con "Eso es un insumo: no se vende.")
- Modify: `apps/fotoffice/app/(shell)/ventas/catalogo/[productId]/store-actions.ts` y la ficha (no ofrecer publicar en la tienda un INSUMO)
- Modify: `apps/fotoffice/lib/pedidos/pedidos.ts` (alta: rechazar ítems INSUMO, mismo mensaje)
- Test: `apps/fotoffice/lib/sales/vendible.test.ts`, y casos en tests existentes de `repository`/`combos`/`checkout` donde haya molde.

- [ ] **Step 1:** Tests: `esVendible("INSUMO") === false`, `esVendible("PRODUCTO") === true`, `esVendible("SERVICIO") === true`; test de `findProductByCode` (Review Focus 1) que verifica que el `where` incluye `kind: { not: "INSUMO" }` (o tx en memoria que no devuelve el insumo); test de `guardarComponentes` rechazando un INSUMO.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar en todos los archivos listados. Luego `grep -rnE "product\.(findMany|findFirst)" apps/fotoffice/lib apps/fotoffice/app` y revisar cada uno que **ofrezca** productos para vender o presupuestar; si hay otro, aplicar `NO_ES_INSUMO` y anotarlo en el commit.
- [ ] **Step 4:** → PASS + typecheck. Commit `Que los insumos no aparezcan para vender`.

### Task 5: Descontar insumos al vender

**Files:**
- Modify: `apps/fotoffice/lib/sales/record-sale.ts`
- Test: `apps/fotoffice/lib/sales/record-sale.test.ts`

**Interfaces:** Consumes `planificarConsumo`, `aplicarConsumo` (Task 3).

Orden dentro de `recordSale`: (1) `planificarConsumo` con líneas `{ ref: <índice provisorio>, productId, qty }`; (2) **una** llamada a `lockStockRows` con `productIds` = productos del ticket ∪ `plan.insumoIds`; (3) lo de siempre (venta, ítems, Caja, `descontarStock`); (4) re-mapear `ref` del índice al `SaleItem.id` real (`itemIds[i]`) y `aplicarConsumo(..., sourceModule:"sales", sourceRef: saleId)`.

- [ ] **Step 1: Tests:**
  - `"descuenta 2 copias del kit por cada 15x20 vendida"`: ticket 3×15x20 ⇒ un `stockMovement.create` CONSUMO `qty:-6`, `note:"consumo:item:<id del SaleItem>"`.
  - `"bloquea productos e insumos en una sola llamada y antes de escribir"`: el primer `$queryRaw` incluye el id del insumo; ninguna escritura antes.
  - `"un servicio sin stock con receta consume igual"`.
  - `"sin recetas no escribe consumos"`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS (incluidos los tests viejos del archivo). Commit `Descontar insumos al vender`.

### Task 6: Devolver insumos al anular

**Files:**
- Modify: `apps/fotoffice/lib/sales/void-sale.ts`
- Test: `apps/fotoffice/lib/sales/void-sale.test.ts`

Orden: `consumosPendientesDeDevolver({sourceModule:"sales", sourceRef: saleId, refs: null})` → `lockStockRows` con productos de los ítems ∪ insumos pendientes (una llamada; reemplaza la actual) → devolución de productos como hoy → `devolverConsumos`.

- [ ] **Step 1: Tests:**
  - `"devuelve lo descontado aunque la receta haya cambiado"` (Review Focus 2): movimientos CONSUMO kit -6; recetas actuales dicen 1 ⇒ DEVOLUCION `+6`, nota `consumo:item:x`.
  - `"anular dos veces no devuelve dos veces"`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit `Devolver insumos al anular una venta`.

### Task 7: Pedidos con seña

**Files:**
- Modify: `apps/fotoffice/lib/pedidos/pedidos.ts` (`apartarStock`, `devolverStockApartado`)
- Test: el test existente de pedidos que cubre apartado/cancelación (`lib/pedidos/*.test.ts` o `lib/circuitos/base-en-memoria.ts` si es ahí donde se prueban; seguir el molde vigente)

`apartarStock`: `planificarConsumo` con `ref = l.itemId` **para todas las líneas** (no solo las que controlan stock) → `lockStockRows` único con productos ∪ insumos → movimientos PEDIDO como hoy → `aplicarConsumo(sourceModule:"pedidos", sourceRef: pedidoId)`. Si `d.lineas` está vacío, no hace nada.
`devolverStockApartado`: calcular las posiciones entregadas como hoy; `refs` = ids de ítem **no entregados** → `consumosPendientesDeDevolver({sourceModule:"pedidos", refs})` → un `lockStockRows` con productos a devolver ∪ insumos → devoluciones de producto como hoy → `devolverConsumos`. Salir temprano solo si no hay nada de ninguno de los dos.

- [ ] **Step 1: Tests:**
  - `"al tomar un pedido de 10 copias 15x20 se descuentan 20 del kit"`.
  - `"al cancelar con una línea entregada y otra no, vuelve solo el insumo de la no entregada"` (Review Focus 3), y la devolución de producto con nota `item:<id>` sigue ocurriendo para la no entregada.
  - `"cancelar dos veces no duplica"`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit `Descontar insumos al tomar un pedido con seña`.

### Task 8: Alta y edición de insumos

**Files:**
- Modify: `apps/fotoffice/lib/sales/product-form.ts` (+ test `product-form.test.ts`)
- Create: `apps/fotoffice/lib/stock/insumo-form.ts` (+ `insumo-form.test.ts`)
- Modify: `apps/fotoffice/app/(shell)/ventas/product-form.tsx`, `app/(shell)/ventas/actions.ts` (crear/guardar producto escribe/actualiza `FotofficeInsumo` en la misma transacción cuando `kind = INSUMO`)
- Modify: `apps/fotoffice/app/(shell)/ventas/catalogo/page.tsx` (filtro/etiqueta "Insumos")

**Interfaces:**
```ts
export type InsumoFormValues = { unidad: string; unidadCompra: string | null; unidadesPorCompra: number | null };
export function parseInsumoForm(fd: FormData): { ok: true; values: InsumoFormValues } | { ok: false; error: string };
```
Reglas: `unidad` obligatoria ("Decí en qué se cuenta: copias, sobres, ml…"); `unidadesPorCompra` entero ≥ 1 o vacío; si hay `unidadCompra` sin `unidadesPorCompra` ⇒ error "Decí cuántas unidades trae cada {unidadCompra}.". En `parseProductForm`: `kind = INSUMO` fuerza `tracksStock = true` y acepta precio vacío como 0.

- [ ] **Step 1: Tests:** `parseProductForm` con `kind=INSUMO`, `priceArs=""`, `tracksStock=off` ⇒ ok, `priceMinor 0`, `tracksStock true`; `parseInsumoForm` casos válido (kit 640), sin unidad, unidadCompra sin cantidad, cantidad 0.
- [ ] **Step 2–4:** FAIL → implementar formulario (campos de insumo visibles solo con tipo Insumo; precio oculto) → PASS. Commit `Dar de alta insumos con su unidad de compra`.

### Task 9: Receta en la ficha del producto y "Sugerir desde Impresión"

**Files:**
- Create: `apps/fotoffice/lib/stock/receta.ts` (puro) + `receta.test.ts`
- Create: `apps/fotoffice/lib/stock/receta-servidor.ts` (`leerReceta`, `guardarReceta`, `sugerirDesdeImpresion`)
- Create: `apps/fotoffice/app/(shell)/ventas/catalogo/[productId]/receta-section.tsx` y acción en `.../receta-actions.ts`
- Modify: `apps/fotoffice/app/(shell)/ventas/catalogo/[productId]/page.tsx` (mostrar la sección solo si el producto no es INSUMO)

**Interfaces:**
```ts
export type LineaReceta = { insumoId: string; quantity: number; porCada: number };
export function normalizarReceta(productId: string, entrada: readonly LineaReceta[]): { ok: true; valor: LineaReceta[] } | { ok: false; error: string };
export function sugerirLineas(d: { unidad: "HOJA" | "COPIA" | "PIEZA"; piezasPorHoja: number; consumos: readonly { insumoId: string; quantity: number }[] }): LineaReceta[];
export function piezasPorHojaSugeridas(d: { tipoPieza: "COPIA" | "CARNET" | "POLAROID"; unidad: "HOJA" | "COPIA" | "PIEZA"; tamanoHoja: string }): number;
export async function guardarReceta(workspaceId: string, productId: string, entrada: readonly LineaReceta[]): Promise<{ ok: true } | { ok: false; error: string }>;
export async function sugerirDesdeImpresion(workspaceId: string, productId: string, piezasPorHoja: number): Promise<LineaReceta[]>;
```
`normalizarReceta`: rechaza duplicados del mismo insumo ("Ese insumo ya está en la receta."), rechaza `quantity` no entera o ≤ 0 ("La cantidad tiene que ser un número entero mayor que cero."), rechaza `porCada` no entero o < 1 ("«Cada cuántas» tiene que ser un número entero desde 1."), rechaza que el insumo sea el mismo producto. `guardarReceta` (transacción): verifica que el producto sea del workspace y no INSUMO, que cada `insumoId` sea `kind = INSUMO` del workspace ("Eso no es un insumo de este negocio."), reemplaza la lista entera. `sugerirLineas`: cada consumo del tamaño de hoja ⇒ `{ insumoId, quantity: consumo, porCada: unidad === "PIEZA" ? piezasPorHoja : 1 }`. `piezasPorHojaSugeridas`: POLAROID con unidad PIEZA en hoja 10x15, 13x18 o 15x20 ⇒ 2; todo lo demás ⇒ 1. `sugerirDesdeImpresion` lee `FotofficeProductoProduccion` (salida + tamaño de hoja) y `FotofficeConsumoTamano` de ese par; sin producción ⇒ `[]`. La sugerencia **no guarda**: precarga el formulario; la persona toca "Guardar".

UI: lista de líneas que se leen como frase: "[2] [copias 10x15 ▾ Kit Kodak 305] cada [2] unidades vendidas" + quitar; "Agregar insumo"; "Sugerir desde Impresión" (si el producto tiene producción; si la unidad es PIEZA pregunta "¿Cuántas entran por hoja?" con el valor de `piezasPorHojaSugeridas`); debajo, ejemplo calculado en vivo: "Vender 3 gasta 2 copias 10x15 (se redondea para arriba: no se juntan piezas de distintos clientes en una hoja)."; "Guardar". Texto de ayuda: "Lo que gasta una unidad vendida. Se descuenta solo al cobrar y al tomar un pedido."

- [ ] **Step 1: Tests:** `normalizarReceta` (duplicado rechaza, quantity 0 rechaza, 1.5 rechaza, porCada 0 rechaza, mismo producto rechaza); `sugerirLineas` (`HOJA` con kit 2 ⇒ `[{kit,2,porCada:1}]`; `PIEZA` con 2 por hoja y kit 1 ⇒ `[{kit,1,porCada:2}]`; sin consumos ⇒ `[]`); `piezasPorHojaSugeridas` (POLAROID/PIEZA/10x15 ⇒ 2; POLAROID/PIEZA/13x18 ⇒ 2; CARNET/HOJA/10x15 ⇒ 1; COPIA/COPIA/10x15 ⇒ 1).
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit `Armar la receta de consumo de cada producto`.

### Task 10: Kodak 305 en un toque y pantalla Stock con insumos

**Files:**
- Create: `apps/fotoffice/lib/stock/kodak305.ts` (+ test del puro)
- Modify: `apps/fotoffice/app/(shell)/ventas/stock/page.tsx`, `app/(shell)/ventas/stock-form.tsx`, `app/(shell)/ventas/actions.ts` (`recordStockEntryAction`)
- Modify: `apps/fotoffice/lib/sales/repository.ts` (`ProductRow` suma `kind` ya existe; agregar `insumo: { unidad; unidadCompra; unidadesPorCompra } | null` al select)

**Interfaces:**
```ts
export const KODAK_305 = {
  salida: "Kodak 305",
  insumo: { nombre: "Kit Kodak 305 (copias 10x15)", unidad: "copias 10x15", unidadCompra: "Kit 305 6R", unidadesPorCompra: 640 },
  consumoPorTamano: { "10x15": 1, "13x18": 2, "15x20": 2 },
} as const;
export function entradaEnUnidades(d: { cantidad: number; enUnidadDeCompra: boolean; unidadesPorCompra: number | null; costoMinor: number | null }): { qty: number; unitCostMinor: number | null };
export async function asegurarKodak305(workspaceId: string): Promise<{ ok: true; insumoId: string; creado: boolean } | { ok: false; error: string }>;
```
`asegurarKodak305` (idempotente, una transacción con `pg_advisory_xact_lock` por workspace): llama `asegurarConfiguracion` (crea salida y tamaños si faltan), busca la salida "Kodak 305" (si no está: `{ok:false, error:"No encontramos la Kodak 305 en Impresión."}`), busca un `FotofficeInsumo` ya ligado a consumos de esa salida o crea el `Product` (`kind INSUMO`, `tracksStock true`, `priceArs 0`, `stockQty 0`, sin movimiento INICIAL) + `FotofficeInsumo`; crea las filas de `FotofficeConsumoTamano` que falten para 10x15/13x18/15x20. Nunca toca existencia.
`entradaEnUnidades`: en unidad de compra ⇒ `qty = cantidad × unidadesPorCompra`, `unitCostMinor = round(costo / unidadesPorCompra)`; si no ⇒ igual.

Pantalla Stock: secciones "Para reponer" (como hoy, incluye insumos), "Insumos", "Productos". Cada fila de insumo muestra "Existencia: 320 copias 10x15". En "Cargar entrada" de un insumo con unidad de compra: casilla "Cargo en Kit 305 6R (640 c/u)" y el costo se interpreta por kit. Si el workspace tiene la salida Kodak 305 y no tiene su insumo: tarjeta "Controlá el ribbon de la Kodak 305" con botón "Configurar" que llama `asegurarKodak305` y luego invita a "Ajustar por conteo".

- [ ] **Step 1: Tests:** `entradaEnUnidades({cantidad:2,enUnidadDeCompra:true,unidadesPorCompra:640,costoMinor:12_000_000})` ⇒ `{qty:1280, unitCostMinor:18750}`; sin unidad de compra ⇒ igual a la entrada; `KODAK_305.consumoPorTamano["13x18"] === 2`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Commit `Configurar la Kodak 305 y mostrar insumos en Stock`.

### Task 11: Guías nuevas con capturas

**Files:**
- Modify: `apps/fotoffice/lib/instructivos/tipos.ts` (sección `"Stock"`), `lib/instructivos/catalogo.ts` (registrar las tres guías al final de la nueva sección), y el test del catálogo si valida secciones/slugs
- Create: `lib/instructivos/guias/stock-insumos-alta.ts`, `stock-receta-consumo.ts`, `stock-contar-y-ajustar.ts`
- Create: `lib/instructivos/capturas/stock-insumos-alta.json`, `stock-receta-consumo.json`, `stock-contar-y-ajustar.json` (formato de `capturas/ventas-mostrador.json`)
- Create: imágenes en `apps/fotoffice/public/instructivos/<slug>/NN-*.jpg`
- Modify: `lib/instructivos/guias/ventas-mostrador.ts` (en el paso de cobrar, `sistema`: "También descuenta los insumos de la receta de cada producto.")

Contenido (todas `moduleKey: SALES_MODULE_KEY`, `seccion: "Stock"`):
1. `stock-insumos-alta` — "Dar de alta un insumo": Catálogo → Nuevo → tipo Insumo; unidad; unidad de compra (ejemplo Kit 305 6R = 640); el botón "Configurar" de la Kodak 305 en Stock. `sistema`: "Los insumos no aparecen en el Cobrador ni en la tienda."
2. `stock-receta-consumo` — "Decir cuánto gasta cada producto": ficha del producto → Consumo de insumos; ejemplo foto carnet = 1 copia + 1 sobre; 15x20 = 2 copias; Polaroid 7,5×10 = 1 copia cada 2 (3 Polaroid gastan 2 copias: no se juntan clientes en una hoja); instantánea y "para retirar" son productos distintos con su precio; "Sugerir desde Impresión". `sistema`: "Al cobrar o tomar un pedido se descuenta solo; si anulás o cancelás, vuelve."
3. `stock-contar-y-ajustar` — "Contar lo que hay y corregir": Stock → Ajustar por conteo, nota obligatoria; Cargar entrada en kits.

Capturas: levantar FOTOFFICE local desde el worktree (`next dev --webpack`, ver memoria de Agenda) contra una base de prueba o la rama local de desarrollo, en un workspace de demostración con datos de ejemplo (Kit Kodak 305, sobres de carnet, "Foto carnet x4", "Copia 15x20"); **nunca** datos de clientes reales ni la base de producción. Tomar las capturas con el navegador integrado siguiendo cada `.json`; guardarlas en JPG.

- [ ] **Step 1:** Test del catálogo de instructivos (si existe) espera los tres slugs nuevos y que cada paso con `imagen` tenga `imagenAlt` → FAIL.
- [ ] **Step 2:** Escribir guías y `.json`; tomar capturas.
- [ ] **Step 3:** → PASS; abrir `/instructivos` en local y verificar que la sección "Stock" muestra las tres guías con imágenes. Commit `Guías de insumos, recetas y conteo`.

### Task 12: Verificación final, migración y PR

- [ ] **Step 1:** `pnpm --filter fotoffice typecheck`, `pnpm --filter fotoffice test`, `pnpm --filter fotoffice lint` → sin errores (confirmar que typecheck no murió por memoria).
- [ ] **Step 2:** Prueba manual local: crear insumo kit (o usar "Configurar" Kodak), receta 15x20 = 2, vender 3 ⇒ existencia −6; Polaroid 7,5×10 (1 cada 2), vender 3 ⇒ −2 más; anular ⇒ vuelve a 0; pedido con seña de 2 ⇒ −4; cancelar ⇒ 0. Escanear el código del kit en el Cobrador ⇒ no lo agrega.
- [ ] **Step 3:** Aplicar `migration.sql` en la base de FOTOFFICE (Neon `divine-hall-10689679`, rama `development`) y registrar la fila en `_prisma_migrations` con el SHA-256 del archivo; verificar con `SELECT to_regclass('"FotofficeInsumo"'), to_regclass('"FotofficeRecetaInsumo"'), to_regclass('"FotofficeConsumoTamano"')`. **Pedir confirmación a Daniel antes de escribir en producción.**
- [ ] **Step 4:** PR contra `main` con resumen en español, aclarando: "migración aplicada en FOTOFFICE; no hace falta en otras bases (tablas nuevas solo de FOTOFFICE; sin columnas nuevas en tablas compartidas)".
