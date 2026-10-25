# Stock — Etapa 2 (recepción de pedidos con lector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recibir un pedido entero en una sola pantalla —lector de códigos, cantidad, costo, alta rápida de lo nuevo— y confirmarlo como entradas de stock.

**Architecture:** Dos tablas nuevas (`FotofficeRecepcion`, `FotofficeRecepcionLinea`). Un módulo puro (`lib/stock/recepcion.ts`) con las reglas (sumar escaneos, validar, convertir a movimientos); un módulo de servidor (`lib/stock/recepcion-servidor.ts`) con el borrador y la confirmación transaccional (un `lockStockRows` + un `applyStockMovement` ENTRADA por línea). Pantallas bajo `/ventas/stock/recepcion`.

**Tech Stack:** Next.js (App Router, server actions — leer `apps/fotoffice/AGENTS.md` y `node_modules/next/dist/docs/` ante la duda), Prisma (schema compartido `packages/db`), Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-stock-insumos-recepcion-e-importacion-design.md` §5 (y §4.1 para unidades de compra).

## Global Constraints

- Sólo tablas nuevas `Fotoffice*`; ninguna columna nueva en tablas compartidas (`Product`, `StockMovement`, `GlobalProduct`…).
- Migración idempotente `20261204120000_fotoffice_stock_recepcion` (posterior a la última de `main`; verificar antes de crearla con `ls packages/db/prisma/migrations | tail -3` y usar un timestamp mayor si hiciera falta). Se aplica a mano en la base de FOTOFFICE (Neon `divine-hall-10689679`, rama `development`) y se registra en `_prisma_migrations` con el SHA-256 del archivo, **antes del merge**.
- Estados de recepción (texto, con CHECK en SQL): `BORRADOR` | `CONFIRMADA` | `DESCARTADA`. Origen de línea: `LECTOR` | `MANUAL` | `IMPORTACION`.
- Confirmar: un `StockMovement` `reason = "ENTRADA"` por línea, `sourceModule = "stock-recepcion"`, `sourceRef = recepcionId`, `unitCostArs` por unidad de stock; toda escritura de stock por `applyStockMovement` precedida de **un** `lockStockRows` con todos los `productId` de la recepción. Actualiza `Product.costArs` al último costo por unidad de stock (si la línea trae costo). Todo en una transacción, que además bloquea la fila de la recepción (`SELECT … FOR UPDATE`) y exige `estado = BORRADOR` (dos clics no confirman dos veces).
- Una recepción confirmada o descartada no se edita.
- Conversión a unidad de stock: reutilizar `entradaEnUnidades` de `lib/stock/kodak305.ts` (qty × unidadesPorCompra; costo ÷ unidadesPorCompra redondeado).
- Búsqueda por código en la recepción **incluye insumos** (a diferencia del Cobrador): no reutilizar `findProductByCode` (excluye INSUMO); usar `normalizeBarcode` y buscar `barcode` exacto o `sku` exacto, activos, del workspace.
- Permiso: `requireSalesStaff` (igual que «Cargar entrada»).
- Textos en español rioplatense llano. Montos en pesos.
- Antes de commitear: `pnpm --filter fotoffice test` y `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`.

## Review Focus

1. **Doble confirmación** (doble clic o dos pestañas): la segunda no debe sumar stock otra vez → test en Task 3.
2. **Escanear un código que existe como talle** (`ProductVariant.barcode`): la recepción de etapa 2 no maneja talles; debe avisar «Ese código es de un talle: cargalo desde Stock» en vez de sumar al producto → test en Task 2/3.
3. **Línea con unidad de compra y costo por bulto**: 2 cajas × 12 a $ 24.000 la caja ⇒ +24 unidades a $ 2.000 c/u → test en Task 2.
4. **Producto de otro workspace o dado de baja** en una línea al confirmar: rechaza toda la confirmación con mensaje claro, sin escribir nada → test en Task 3.
5. **Código de barras ya cargado en otro producto del mismo negocio** en el alta rápida: no duplica; usa el existente → test en Task 4.

---

### Task 1: Esquema y migración

**Files:** `packages/db/prisma/schema.prisma`; `packages/db/prisma/migrations/20261204120000_fotoffice_stock_recepcion/migration.sql`; `apps/fotoffice/lib/stock/recepcion-constantes.ts` (+ test).

**Produces:**
- `FotofficeRecepcion`: `id` cuid, `workspaceId`, `numero Int` (correlativo por workspace, único `(workspaceId, numero)`), `proveedorId String?` (FK `FotofficeProveedor`, SetNull), `fecha DateTime`, `comprobante String?`, `estado String @default("BORRADOR")`, `preciosConIva Boolean @default(true)`, `archivoKey String?`, `nota String?`, `createdByUserId Int?`, `confirmedAt DateTime?`, `confirmedByUserId Int?`, `createdAt`, `updatedAt`; FK workspace Cascade; `@@index([workspaceId, estado, createdAt])`.
- `FotofficeRecepcionLinea`: `id`, `recepcionId` (Cascade), `workspaceId`, `productId String?` (FK `Product`, SetNull), `descripcionOriginal String`, `codigoBarras String?`, `cantidad Int`, `enUnidadDeCompra Boolean @default(false)`, `unidadesPorCompra Int?`, `costoUnitarioArs Decimal? @db.Decimal(12,2)` (por la unidad en que se cargó), `origen String`, `order Int @default(0)`, `createdAt`, `updatedAt`; `@@index([recepcionId, order])`, `@@index([workspaceId, productId])`.
- SQL CHECKs: estado ∈ {BORRADOR, CONFIRMADA, DESCARTADA}; origen ∈ {LECTOR, MANUAL, IMPORTACION}; `cantidad > 0`; `unidadesPorCompra IS NULL OR unidadesPorCompra >= 1`.
- `recepcion-constantes.ts`: `ESTADOS_RECEPCION`, `ORIGENES_LINEA`, `SOURCE_MODULE_RECEPCION = "stock-recepcion"`.

- [ ] Test de constantes (valores exactos) → FAIL → implementar → `prisma validate` + `prisma generate` → PASS. Commit `Esquema de recepción de pedidos`.

### Task 2: Reglas puras de la recepción

**Files:** `apps/fotoffice/lib/stock/recepcion.ts` (+ `recepcion.test.ts`).

**Produces:**
```ts
export type LineaBorrador = { id: string; productId: string | null; descripcionOriginal: string; codigoBarras: string | null; cantidad: number; enUnidadDeCompra: boolean; unidadesPorCompra: number | null; costoUnitarioMinor: number | null; origen: "LECTOR" | "MANUAL" | "IMPORTACION" };
export function lineaParaEscaneo(lineas: readonly LineaBorrador[], productId: string): { accion: "sumar"; lineaId: string } | { accion: "crear" };
export function validarParaConfirmar(lineas: readonly LineaBorrador[]): { ok: true } | { ok: false; error: string };
export function movimientoDeLinea(l: LineaBorrador): { productId: string; qty: number; unitCostMinor: number | null };
export function totalRecepcionMinor(lineas: readonly LineaBorrador[]): number;
export function costoSubio(anteriorMinor: number | null, nuevoPorUnidadMinor: number | null): boolean;
```
Reglas: `lineaParaEscaneo` suma a la **primera** línea con ese producto y `enUnidadDeCompra === false`; si no hay, crear. `validarParaConfirmar`: al menos una línea («Cargá al menos un producto.»), toda línea con producto («Hay líneas sin producto: elegilo o quitalas.»), cantidad entero > 0 («La cantidad tiene que ser mayor que cero.»), si `enUnidadDeCompra` exige `unidadesPorCompra ≥ 1` («Decí cuántas unidades trae cada bulto.»). `movimientoDeLinea` usa `entradaEnUnidades`. `totalRecepcionMinor` = Σ cantidad × costo (por la unidad cargada; sin costo suma 0).

- [ ] Tests: escaneo suma/crea; las 4 validaciones con sus mensajes; «2 cajas × 12 a 2.400.000 minor ⇒ qty 24, unitCostMinor 200.000» (Review Focus 3); total; `costoSubio(100,120) === true`, `(null,120) === false`, `(120,100) === false`. → FAIL → implementar → PASS. Commit `Reglas de la recepción de pedidos`.

### Task 3: Borrador y confirmación en la base

**Files:** `apps/fotoffice/lib/stock/recepcion-servidor.ts` (+ test con tx falso, molde `lib/sales/void-sale.test.ts`).

**Produces:**
```ts
export async function crearBorrador(workspaceId: string, userId: number | null): Promise<{ id: string; numero: number }>;
export async function leerRecepcion(workspaceId: string, id: string): Promise<RecepcionDetalle | null>; // con líneas, producto (nombre, kind, unidad de stock, costArs, priceArs, ficha insumo)
export async function listarRecepciones(workspaceId: string): Promise<RecepcionFila[]>; // últimas 50, con total y proveedor
export async function buscarParaRecepcion(workspaceId: string, codigo: string): Promise<{ tipo: "producto"; productId: string } | { tipo: "talle" } | { tipo: "global"; nombre: string; marca: string | null } | { tipo: "nada" }>;
export async function escanear(workspaceId: string, recepcionId: string, codigo: string): Promise<{ ok: true; resultado: "sumado" | "agregado" } | { ok: false; error: string; alta?: { codigo: string; nombre?: string; marca?: string | null } }>;
export async function guardarLinea(workspaceId: string, recepcionId: string, linea: Partial<LineaBorrador> & { id?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
export async function quitarLinea(workspaceId: string, recepcionId: string, lineaId: string): Promise<void>;
export async function guardarEncabezado(workspaceId: string, recepcionId: string, d: { proveedorId: string | null; fecha: Date; comprobante: string | null; preciosConIva: boolean; nota: string | null }): Promise<{ ok: true } | { ok: false; error: string }>;
export async function descartar(workspaceId: string, recepcionId: string): Promise<void>;
export async function confirmar(workspaceId: string, recepcionId: string, userId: number | null): Promise<{ ok: true; movimientos: number } | { ok: false; error: string }>;
```
`escanear` usa `buscarParaRecepcion`; `talle` ⇒ error «Ese código es de un talle: cargalo desde Stock.» (Review Focus 2); `global`/`nada` ⇒ `ok:false` con `alta` precargada para que la pantalla abra el alta rápida. Al agregar línea nueva: `enUnidadDeCompra` true y `unidadesPorCompra` de la ficha de insumo si la tiene, si no false/null; `descripcionOriginal` = nombre del producto. Todas las escrituras exigen `estado = BORRADOR` y workspace. `numero` correlativo con el mismo patrón de reintento por choque que `nextSaleNumber` (`lib/sales/sale-number.ts`). `confirmar` sigue las Global Constraints (FOR UPDATE de la recepción, verificación de productos activos del workspace — «Hay productos que ya no existen o están dados de baja: revisá las líneas.» —, un `lockStockRows`, `applyStockMovement` por línea, `costArs` actualizado, estado CONFIRMADA, `confirmedAt/By`).

- [ ] Tests: confirmar escribe un ENTRADA por línea con `sourceModule:"stock-recepcion"`, `sourceRef` y costo por unidad de stock; actualiza `costArs`; segunda confirmación ⇒ `ok:false` «Esa recepción ya está confirmada.» sin escribir (Review Focus 1); producto ajeno/inactivo ⇒ rechazo sin escrituras (Review Focus 4); `escanear` suma, agrega, avisa talle y devuelve `alta`; escrituras sobre CONFIRMADA rechazadas. → FAIL → implementar → PASS. Commit `Borrador y confirmación de la recepción`.

### Task 4: Alta rápida desde la recepción

**Files:** `apps/fotoffice/lib/stock/alta-rapida.ts` (+ test).

**Produces:**
```ts
export type AltaRapida = { codigo: string | null; nombre: string; kind: "PRODUCTO" | "INSUMO"; precioMinor: number | null; unidad: string | null; unidadCompra: string | null; unidadesPorCompra: number | null };
export function validarAltaRapida(d: AltaRapida): { ok: true } | { ok: false; error: string };
export async function crearDesdeRecepcion(workspaceId: string, userId: number | null, recepcionId: string, d: AltaRapida): Promise<{ ok: true; productId: string } | { ok: false; error: string }>;
```
Reglas: nombre obligatorio; PRODUCTO exige precio ≥ 0 («Poné el precio de venta.»); INSUMO exige unidad (mensaje de `parseInsumoForm`); `unidadCompra` sin `unidadesPorCompra` ⇒ error. `crearDesdeRecepcion` en una transacción: si ya hay un producto del workspace con ese `barcode`, lo usa (Review Focus 5); si no, crea `Product` (`tracksStock true`, `globalProductId` vía `upsertGlobalProduct` si hay código), `guardarInsumo` si INSUMO, y agrega la línea (`origen LECTOR` si vino código, `MANUAL` si no) con cantidad 1.

- [ ] Tests de validación y de reuso por código → FAIL → implementar → PASS. Commit `Alta rápida desde la recepción`.

### Task 5: Pantallas

**Files:** `apps/fotoffice/app/(shell)/ventas/stock/recepcion/page.tsx` (historial + botón «Recibir pedido»), `.../recepcion/[id]/page.tsx` (editor), `.../recepcion/[id]/recepcion-editor.tsx` (cliente), `.../recepcion/actions.ts`; link «Recibir pedido» en `app/(shell)/ventas/stock/page.tsx`.

Editor (estado BORRADOR): encabezado (proveedor —`listarProveedores` activo—, fecha, comprobante, «Los costos incluyen IVA»), campo «Escaneá o escribí el código» con foco permanente (vuelve el foco tras cada acción; Enter = escanear), buscador por nombre para agregar sin código, tabla de líneas (producto, cantidad, «en bultos de [n]», costo, costo anterior, si es producto precio y margen; resaltado si `costoSubio`), quitar línea, total, «Confirmar recepción» (pide confirmación: «Se van a sumar N unidades al stock. ¿Confirmás?») y «Descartar». Alta rápida en un diálogo cuando `escanear` devuelve `alta`. Estado CONFIRMADA/DESCARTADA: sólo lectura con quién y cuándo. Historial: número, fecha, proveedor, comprobante, total, estado, quién.

- [ ] Typecheck + lint de los archivos; prueba manual local no requerida (sin base); commit `Pantallas de recepción de pedidos`.

### Task 6: Guía «Recibir un pedido»

**Files:** `lib/instructivos/guias/stock-recibir-pedido.ts`, `lib/instructivos/capturas/stock-recibir-pedido.json`, `lib/instructivos/catalogo.ts` (registrar en «Stock»), test del catálogo.

Contenido: abrir Stock → «Recibir pedido»; elegir proveedor y comprobante; escanear caja por caja (cada escaneo suma 1); cargar en bultos; costo y aviso si subió; alta rápida de lo que no está; confirmar (qué hace el sistema solo: suma al stock, actualiza el costo; una confirmada no se edita, se corrige con «Ajustar por conteo»); dejar a medias y retomar desde el historial. Sin imágenes (se toman después del deploy).

- [ ] Test del catálogo con el slug nuevo → FAIL → implementar → PASS. Commit `Guía para recibir un pedido`.

### Task 7: Verificación, migración y PR

- [ ] Suite completa + typecheck + lint de archivos tocados.
- [ ] Revisión general de la rama.
- [ ] Aplicar y registrar la migración en producción; verificar tablas y CHECKs.
- [ ] PR, CI en verde, merge, verificación en fotoffice.com (abrir `/ventas/stock/recepcion` y un borrador; descartar el borrador de prueba).
