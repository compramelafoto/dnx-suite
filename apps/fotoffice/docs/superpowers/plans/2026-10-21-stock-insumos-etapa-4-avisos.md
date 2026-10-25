# Stock — Etapa 4 (avisos de compra y días de cobertura) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que FOTOFFICE diga qué hay que comprar y para cuántos días alcanza cada cosa, en la pantalla Stock y en el inicio del panel, y arme la lista para cada proveedor.

**Architecture:** Un módulo puro (`lib/stock/avisos.ts`) calcula consumo diario, días de cobertura y quién va a «Para comprar»; un módulo de servidor (`lib/stock/avisos-servidor.ts`) lee los movimientos de los últimos 30 días agrupados por producto. Sin tablas ni columnas nuevas.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-stock-insumos-recepcion-e-importacion-design.md` §7, con estas decisiones del controlador: el aviso va en la pantalla Stock y en una tarjeta del inicio (la «Bandeja» es la de WhatsApp y la campana es de novedades de socios: no se usan); el umbral de pocos días es fijo (7) y no hay `leadTimeDays` (sería una columna nueva en `Product`, tabla compartida).

## Global Constraints

- Sin migraciones, sin columnas nuevas.
- Consumo de un producto en 30 días = − Σ `qty` de `StockMovement` con `reason` en {VENTA, CONSUMO, PEDIDO} + Σ `qty` con `reason = DEVOLUCION` (las devoluciones netean), `createdAt` en los últimos 30 días corridos, filtrado por `workspaceId`; nunca negativo. Consumo diario = consumo30 / 30.
- Días de cobertura = `floor(stockQty / consumoDiario)` si consumoDiario > 0 y stockQty > 0; si stockQty ≤ 0 ⇒ 0; si no hubo consumo ⇒ `null` («Sin consumo en 30 días»).
- «Para comprar» = `needsRestock` (de `lib/sales/stock.ts`, ya incluye negativos y bajo mínimo) **o** días de cobertura ≤ 7. Orden: negativos primero, después menos días, después nombre.
- Texto por fila: «Te alcanza para ~N días» (N ≥ 1), «Se termina hoy» (0 con consumo), «Sin consumo en 30 días» (null). Debajo del mínimo: «Debajo del mínimo (M)».
- «Lista para el proveedor»: agrupa «Para comprar» por `Product.supplierName` (vacío ⇒ «Sin proveedor»); para cada ítem sugiere cantidad = max(mínimo − existencia, consumo de 30 días − existencia, 1) redondeada para arriba, y en insumos con unidad de compra la expresa en bultos (`ceil(qty / unidadesPorCompra)` + nombre de la unidad de compra). Botón «Copiar lista» por proveedor con texto plano: «Pedido para {proveedor}:\n- {cantidad} {unidad} {nombre}\n…».
- Tarjeta del inicio: «Para comprar: N» (N = cantidad en «Para comprar») con hasta 3 nombres y enlace a `/ventas/stock`; visible con el mismo permiso que la pantalla Stock (`requireSalesStaff` / nivel de Ventas en `homeWidgetGates`). Si N = 0, no se muestra.
- Textos en español rioplatense llano. Todo filtrado por workspace. `.fo-input` necesita `style` para anchos chicos. Cliente nunca importa `server-only`; correr `next build` local antes del PR.

## Review Focus
1. Producto con existencia negativa y sin consumo: va a «Para comprar» y dice «Se termina hoy»/«Debajo del mínimo» correctamente → test Task 1.
2. Devoluciones que superan las ventas del período: consumo 0, no negativo → test Task 1/2.
3. Insumo con unidad de compra: la lista sugiere bultos (640 copias por kit) → test Task 1.
4. Workspace sin ventas: la página y el inicio no rompen y no muestran tarjeta → test Task 3.

---

### Task 1: Cálculo puro
**Files:** `lib/stock/avisos.ts` (+ test).
**Produces:** `consumoDiario(consumo30: number): number`, `diasDeCobertura(stockQty: number, consumoDiario: number): number | null`, `textoCobertura(dias: number | null): string`, `type ItemStock = { productId; nombre; stockQty; minStockQty: number | null; tracksStock: boolean; unidad: string | null; proveedor: string | null; unidadCompra: string | null; unidadesPorCompra: number | null; consumo30: number }`, `paraComprar(items): (ItemStock & { dias: number | null })[]`, `listaPorProveedor(items): { proveedor: string; renglones: { texto: string }[]; textoCopiable: string }[]`.
- [ ] Tests (Review Focus 1–3, orden, textos exactos). Commit `Calcular cobertura y qué comprar`.

### Task 2: Lectura de consumo
**Files:** `lib/stock/avisos-servidor.ts` (+ test con tx falso).
**Produces:** `consumo30PorProducto(workspaceId: string, ahora?: Date): Promise<Map<string, number>>` (un `groupBy` por `productId` y `reason`, o SQL con parámetros — ver memoria: Prisma manda bigint en SQL crudo), `itemsDeStock(workspaceId): Promise<ItemStock[]>` (productos activos con `tracksStock`, ficha de insumo, `supplierName`).
- [ ] Tests (Review Focus 2, filtro por workspace y 30 días). Commit `Leer el consumo de los últimos 30 días`.

### Task 3: Pantalla Stock e inicio
**Files:** `app/(shell)/ventas/stock/page.tsx` (sección «Para comprar» arriba con días y «Lista para el proveedor» con «Copiar lista»; cada fila de Insumos/Productos muestra su cobertura), un componente cliente chico para copiar; `lib/workspace-home/load.ts` + `gates.ts` + la tarjeta en `app/workspace/page.tsx` (seguir el patrón de `pedidosNuevos`/`coberturas`, con `seguro()`).
- [ ] Tests de gates/load si existen moldes; typecheck, eslint, `next build`. Commit `Avisos de compra en Stock y en el inicio`.

### Task 4: Guía y cierre
**Files:** `lib/instructivos/guias/stock-avisos-y-compras.ts`, capturas json, catálogo + test. Contenido: leer «Para comprar», los días de cobertura, la tarjeta del inicio, «Copiar lista» para mandar el pedido al proveedor, ajustar el mínimo desde el catálogo.
- [ ] Test del catálogo; commit `Guía de avisos y compras`. Revisión general, PR, CI, merge, verificación en fotoffice.com.
