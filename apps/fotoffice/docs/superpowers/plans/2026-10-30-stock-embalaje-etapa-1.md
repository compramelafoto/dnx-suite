# Stock — Etapa 1: embalaje por entrega · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada venta, pedido con seña, presupuesto confirmado y pedido de impresión online descuente solo los sobres y bolsas que usa, con la posibilidad de cambiarlos a mano, y que anular o cancelar los devuelva.

**Architecture:** un cálculo PURO (`lib/stock/embalaje.ts`) decide los envoltorios a partir de las piezas de la entrega. El embalaje entra al mismo plan de consumo que ya usan las recetas (`planificarConsumo` → `aplicarConsumo` → `consumosPendientesDeDevolver` → `devolverConsumos`) como una línea más con `ref = "embalaje"` y nota `consumo:embalaje`, así hereda el bloqueo de filas, la reversión y todos los caminos de venta sin duplicar lógica. Dos tablas nuevas de FOTOFFICE guardan los envoltorios y la forma de entrega de cada producto.

**Tech Stack:** Next.js (versión del repo: leer `node_modules/next/dist/docs/` antes de tocar rutas o acciones), Prisma 6 (`packages/db`), PostgreSQL en Neon, vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-30-stock-embalaje-avisos-y-conteo-design.md` (§4 y §12).

**Worktree:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/stock-embalaje-avisos`, rama `docs/fotoffice-stock-embalaje-avisos` (se renombra a `feat/fotoffice-stock-embalaje` antes del PR). Todos los comandos desde `apps/fotoffice` salvo indicación.

## Global Constraints

- **Sin columnas nuevas en `Product`, `StockMovement` ni `SaleItem`**: solo tablas nuevas `Fotoffice*`. Una columna faltante rompe TODA lectura del modelo (P2022) en todas las apps.
- **La migración se aplica en la base de producción ANTES de fusionar** (rama Neon `development` del proyecto `compramelafoto`, `DIRECT_URL` de `apps/fotoffice/.env.local`): `planificarConsumo` corre en cada cobro, y si las tablas no existen, **ninguna venta se puede cobrar**. Después `prisma migrate resolve --applied 20270103120000_fotoffice_stock_embalaje` desde `packages/db`.
- Migración idempotente (`CREATE TABLE IF NOT EXISTS`, CHECK y FK dentro de `DO $$ … IF NOT EXISTS`), mismo estilo que `20261203120000_fotoffice_stock_insumos`.
- Vender **nunca** se bloquea por falta de sobres o bolsas: el insumo puede quedar negativo.
- Nota de los movimientos de embalaje: exactamente `consumo:embalaje` (`NOTA_EMBALAJE`). Nunca `item:<id>` ni `consumo:item:<id>`.
- Medidas en **cm**, comparadas sin orientación (15x21 = 21x15). Cantidades enteras.
- Funciones puras que usan componentes cliente van en archivos **sin** `import "server-only"`. Un archivo `"use server"` solo exporta funciones `async`.
- Textos de pantalla en español rioplatense, claros para el mostrador.
- Chequeo de tipos SIEMPRE con `NODE_OPTIONS=--max-old-space-size=8192` (sin eso muere y devuelve 0). Regenerar el cliente con `pnpm db:generate` desde `packages/db` después de tocar `schema.prisma`.

## Review Focus

1. **Doble descuento entre caminos**: la tienda (`lib/store/credit-payment.ts`) planifica para bloquear y después `recordSale` vuelve a planificar; el embalaje tiene que salir una sola vez → prueba en Task 4 de que `recordSale` escribe un solo juego de movimientos `consumo:embalaje`.
2. **Ticket mixto del Cobrador** (parte se lleva ahora, parte queda como pedido): son dos entregas reales, cada una con su embalaje; ninguna debe tomar las piezas de la otra → prueba en Task 4 sobre `apartarStock` con solo los ítems del pedido.
3. **Envoltorio cambiado a mano que no es envoltorio** (id de otro negocio, de un producto vendible, cantidad negativa o no entera): el servidor lo rechaza → prueba en Task 3.
4. **Cancelar un pedido con algo entregado**: el embalaje NO vuelve; sin nada entregado, vuelve entero → prueba en Task 4.
5. **Pedido de impresión del bot que paga en dos partes** (seña y saldo): descuenta embalaje solo en el primer paso a `PAGADO` → prueba en Task 5.

---

### Task 1: Tablas `FotofficeEmbalaje` y `FotofficeProductoEntrega`

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos nuevos junto a `FotofficeRecetaInsumo`; back-relations en `Workspace` y `Product`, que no agregan columnas)
- Create: `packages/db/prisma/migrations/20270103120000_fotoffice_stock_embalaje/migration.sql`

**Interfaces:**
- Produces: `prisma.fotofficeEmbalaje`, `prisma.fotofficeProductoEntrega`.

```prisma
model FotofficeEmbalaje {
  id              String   @id @default(cuid())
  workspaceId     String
  insumoId        String   @unique   // Product kind INSUMO
  tipo            String             // SOBRE | BOLSA (CHECK)
  admiteAnchoCm   Decimal  @db.Decimal(6, 1)
  admiteAltoCm    Decimal  @db.Decimal(6, 1)
  piezasPorUnidad Int?               // sobre 19x24 → 100; null = sin tope (CHECK > 0)
  orden           Int      @default(0)
  activo          Boolean  @default(true)
  createdAt/updatedAt
  // workspace Cascade; insumo → Product onDelete Cascade
  @@index([workspaceId])
}

model FotofficeProductoEntrega {
  id                String   @id @default(cuid())
  workspaceId       String
  productId         String   @unique
  forma             String   // PIEZA_SUELTA | ENMARCADO | VOLUMEN | SIN_EMBALAJE (CHECK)
  anchoCm           Decimal? @db.Decimal(6, 1)
  altoCm            Decimal? @db.Decimal(6, 1)
  embalajeSiguiente Boolean  @default(false)
  embalajeFijoId    String?  // → FotofficeEmbalaje, onDelete SetNull
  createdAt/updatedAt
  // product Cascade, workspace Cascade
  @@index([workspaceId])
  @@index([embalajeFijoId])
}
```

- [ ] **Step 1:** Agregar los modelos y las relaciones inversas; `pnpm db:generate` en `packages/db`. Esperado: genera sin errores.
- [ ] **Step 2:** Escribir `migration.sql` idempotente: tablas, índices (`insumoId` y `productId` únicos), FKs, y CHECKs `tipo IN ('SOBRE','BOLSA')`, `forma IN (...)`, `piezasPorUnidad IS NULL OR piezasPorUnidad > 0`, medidas `> 0`.
- [ ] **Step 3:** Validar el SQL contra una rama Neon descartable creada desde `development` (crear rama, correr el SQL **dos veces**, `\d` de las tablas, borrar la rama). Esperado: segunda corrida sin errores.
- [ ] **Step 4:** Commit `Tablas de embalaje: envoltorios y forma de entrega de cada producto`.

### Task 2: Cálculo puro del embalaje

**Files:**
- Create: `apps/fotoffice/lib/stock/embalaje.ts` (sin `server-only`)
- Test: `apps/fotoffice/lib/stock/embalaje.test.ts`

**Interfaces:**
- Produces:
```ts
export const REF_EMBALAJE = "embalaje";
export const NOTA_EMBALAJE = "consumo:embalaje";
export type TipoEnvoltorio = "SOBRE" | "BOLSA";
export type FormaEntrega = "PIEZA_SUELTA" | "ENMARCADO" | "VOLUMEN" | "SIN_EMBALAJE";
export type Envoltorio = { insumoId: string; nombre: string; tipo: TipoEnvoltorio; admiteAnchoCm: number; admiteAltoCm: number; piezasPorUnidad: number | null; orden: number };
export type EntregaProducto = { forma: FormaEntrega; anchoCm: number | null; altoCm: number | null; embalajeSiguiente: boolean; embalajeFijoId: string | null };
export type PiezaEntrega = EntregaProducto & { qty: number };
export type EmbalajeCalculado = { insumoId: string; qty: number; motivo: string };
export function calcularEmbalaje(piezas: readonly PiezaEntrega[], envoltorios: readonly Envoltorio[]): EmbalajeCalculado[];
export function piezasDeLineas(
  lineas: readonly { productId: string | null; qty: number }[],
  entregas: ReadonlyMap<string, EntregaProducto>,
  combos: readonly { comboProductId: string; componentProductId: string; quantity: number }[],
): PiezaEntrega[];
export function sugerirEntrega(p: { nombre: string; categoria: string | null; kind: string; hojaMm: { ancho: number; alto: number } | null }): EntregaProducto | null;
```

Reglas (spec §4.3), en este orden:
1. `piezasDeLineas`: un producto con entrega propia aporta una pieza; si no tiene y es combo, se desarma en sus componentes (cantidad × cantidad en el combo, recursivo, profundidad máx. 10); sin entrega ni combo, no aporta. `SIN_EMBALAJE` no aporta.
2. Por cada unidad `ENMARCADO` con medida, se retira una unidad `PIEZA_SUELTA` de la misma medida; si no hay, la más grande que entra en la medida del marco; si ninguna entra, nada.
3. Sueltas restantes que entran en algún `SOBRE` activo (una suelta sin medida —pendrive— entra en cualquiera): se elige el sobre más chico que admite la más grande de ellas; cantidad `piezasPorUnidad ? floor(n / piezasPorUnidad) + 1 : 1`.
4. Grandes = sueltas que no entran en ningún sobre + `ENMARCADO` + `VOLUMEN`. Cada una pide: su `embalajeFijoId` si es un envoltorio activo; si no, la `BOLSA` más chica que la admite (con `embalajeSiguiente`: estrictamente mayor en los dos lados); si ninguna, la bolsa más grande. Se usa **una** bolsa: la mayor de las pedidas (por área, desempate por `orden`).
5. Sin sobres configurados, las sueltas pasan a ser grandes. Sin envoltorios, `[]`.
6. Salida ordenada SOBRE primero y luego BOLSA; `motivo` en palabras ("80 fotos hasta 15x21", "portarretratos 20x25").

`sugerirEntrega`: con `hojaMm` → `PIEZA_SUELTA` con la medida en cm (redondeada a 0,5); nombre o categoría con "portarretrato", "marco" o "cuadro" → `ENMARCADO`, `embalajeSiguiente: true`, medida leída del nombre (`/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/`); "fotolibro" o "álbum" → `VOLUMEN`; "pendrive" → `PIEZA_SUELTA` sin medida; `kind === "SERVICIO"` → `SIN_EMBALAJE`; si no, `null`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Fixture con los envoltorios DNX: sobre 19x24 (admite 15x21, 100 por unidad), bolsas 20x30, 30x45, 35x45 (admiten su medida). Un `it` por fila de la tabla §12 del spec, con exactamente esos resultados, por ejemplo:
```ts
expect(calcularEmbalaje([suelta(10, 15, 100)], DNX)).toEqual([{ insumoId: "sobre", qty: 2, motivo: expect.any(String) }]);
expect(ids(calcularEmbalaje([marco(20, 25, 1), suelta(20, 25, 1)], DNX))).toEqual({ bolsa3045: 1 });
expect(ids(calcularEmbalaje([marco(13, 18, 1), suelta(13, 18, 1), suelta(10, 15, 10)], DNX))).toEqual({ sobre: 1, bolsa2030: 1 });
```
Más: orientación (`suelta(21, 15)` entra en el sobre), sin envoltorios → `[]`, solo bolsas → suelta 10x15 va a la bolsa 20x30, `embalajeFijoId` de un envoltorio inactivo se ignora, combo "portarretratos 13x18 con foto" desarmado da una bolsa 20x30 y ningún sobre, y `sugerirEntrega` para "Portarretratos 20x25 madera" → `{ forma: "ENMARCADO", anchoCm: 20, altoCm: 25, embalajeSiguiente: true, … }`.
- [ ] **Step 2:** `pnpm exec vitest run lib/stock/embalaje.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar en `lib/stock/embalaje.ts`.
- [ ] **Step 4:** Repetir. Esperado: PASS.
- [ ] **Step 5:** Commit `Calcular el embalaje de una entrega`.

### Task 3: El embalaje dentro del plan de consumo

**Files:**
- Create: `apps/fotoffice/lib/stock/embalaje-servidor.ts`
- Modify: `apps/fotoffice/lib/stock/consumo-servidor.ts`
- Test: `apps/fotoffice/lib/stock/embalaje-servidor.test.ts`, `apps/fotoffice/lib/stock/consumo-servidor.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
```ts
// embalaje-servidor.ts
export type EmbalajeElegido = { insumoId: string; qty: number };
export type OpcionesEmbalaje = { modo: "auto" } | { modo: "manual"; elegido: readonly EmbalajeElegido[] } | { modo: "ninguno" };
export async function envoltoriosActivos(tx: Tx, workspaceId: string): Promise<Envoltorio[]>;
export async function planificarEmbalaje(tx: Tx, workspaceId: string, d: {
  lineas: readonly { productId: string | null; qty: number }[];
  piezasSinProducto?: readonly PiezaEntrega[];
  opciones: OpcionesEmbalaje;
}): Promise<EmbalajeCalculado[]>;  // lanza EmbalajeInvalido en manual inválido
export class EmbalajeInvalido extends Error {}
export async function ajustarEmbalaje(tx: Tx, d: {
  workspaceId: string; sourceModule: FuenteConsumo; sourceRef: string;
  deseado: readonly EmbalajeElegido[]; createdByUserId: number | null;
}): Promise<void>;

// consumo-servidor.ts (cambios)
export type FuenteConsumo = "sales" | "pedidos" | "impresiones";
export async function planificarConsumo(tx, workspaceId, lineas, opciones?: {
  embalaje?: OpcionesEmbalaje;               // por omisión { modo: "auto" }
  piezasSinProducto?: readonly PiezaEntrega[];
}): Promise<PlanConsumo>;
```

- `planificarConsumo` agrega las líneas de embalaje como `ConsumoLinea` con `ref: REF_EMBALAJE`, y sus `insumoId` entran en `insumoIds` (para el mismo `lockStockRows`). Si las tablas de embalaje no tienen filas para el negocio, devuelve exactamente lo de hoy.
- `aplicarConsumo`: nota `NOTA_EMBALAJE` cuando `ref === REF_EMBALAJE`; si no, la de hoy.
- `consumosPendientesDeDevolver`: reconoce las dos notas; con `refs` presente, el embalaje solo entra si `refs.has(REF_EMBALAJE)`.
- Manual: cada `insumoId` debe ser un `FotofficeEmbalaje` del negocio (activo o no), `qty` entero 0..999; los de `qty` 0 se omiten; si no, `EmbalajeInvalido("Ese embalaje no es de este negocio.")`.
- `ajustarEmbalaje`: lee lo neto ya descontado con `NOTA_EMBALAJE` para esa fuente, bloquea los insumos (unión de actuales y deseados, `lockStockRows`) y escribe la diferencia por insumo: más → `CONSUMO` negativo, menos → `DEVOLUCION` positivo, misma nota.

- [ ] **Step 1: Pruebas que fallan** (con el `fakeTx` de `consumo-servidor.test.ts` extendido con `fotofficeEmbalaje.findMany` y `fotofficeProductoEntrega.findMany`):
  - `planificarConsumo` con un producto 10x15 y el sobre configurado → `consumos` contiene `{ ref: "embalaje", insumoId: "sobre", qty: 1 }` e `insumoIds` incluye `"sobre"`.
  - Sin envoltorios configurados → el plan es idéntico al de hoy (las pruebas existentes siguen verdes).
  - `aplicarConsumo` escribe `note: "consumo:embalaje"` para esa línea.
  - `consumosPendientesDeDevolver` con `refs: null` devuelve el embalaje; con `refs: new Set(["item1"])` no; con `refs: new Set(["embalaje"])` sí.
  - Manual con un `insumoId` ajeno → rechaza con `EmbalajeInvalido`; con `qty: -1` o `1.5` → rechaza.
  - `ajustarEmbalaje` de `{sobre: 1}` a `{sobre: 2, bolsa2030: 1}` escribe `CONSUMO -1` sobre y `CONSUMO -1` bolsa; de `{sobre: 2}` a `{}` escribe `DEVOLUCION +2`.
- [ ] **Step 2:** `pnpm exec vitest run lib/stock/`. Esperado: FAIL en las nuevas.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: PASS, incluidas todas las pruebas que ya existían en `lib/stock/`.
- [ ] **Step 5:** Commit `El embalaje entra al plan de consumo y se puede ajustar`.

### Task 4: Ventas, tienda, pedidos con seña y presupuestos

**Files:**
- Modify: `apps/fotoffice/lib/sales/record-sale.ts`, `apps/fotoffice/lib/pedidos/pedidos.ts`
- Test: `apps/fotoffice/lib/sales/record-sale.test.ts`, `apps/fotoffice/lib/sales/void-sale.test.ts`, `apps/fotoffice/lib/pedidos/pedidos.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces: `RecordSaleInput.embalaje?: OpcionesEmbalaje` y el mismo campo opcional en el parámetro `d` de `apartarStock`.

- `recordSale`: pasa `input.embalaje` a `planificarConsumo`; al re-mapear `ref` a `itemIds`, deja intacto `REF_EMBALAJE` (hoy lanzaría "Consumo de insumos sin renglón de venta").
- `credit-payment.ts` y `confirmar.ts` no cambian: usan el modo automático (verificar que la tienda siga bloqueando los mismos insumos que después descuenta `recordSale`).
- `apartarStock`: pasa `d.embalaje`.
- `devolverStockApartado`: agrega `REF_EMBALAJE` a `refs` solo si `entregadas.size === 0`.
- `void-sale.ts` no cambia (usa `refs: null`); sus pruebas lo confirman.

- [ ] **Step 1: Pruebas que fallan:**
  - `recordSale` con una 10x15 y sobre configurado → un único movimiento `CONSUMO` con nota `consumo:embalaje`, `sourceModule "sales"`, y sin excepción.
  - `recordSale` con `embalaje: { modo: "ninguno" }` → ningún movimiento de embalaje.
  - `voidSale` de esa venta → `DEVOLUCION +1` del sobre.
  - `apartarStock` de un pedido con un portarretratos 13x18 y su foto → `CONSUMO -1` de la bolsa 20x30 y ninguno del sobre.
  - Cancelar ese pedido sin nada entregado → devuelve la bolsa; con el ítem 0 entregado → no devuelve la bolsa.
- [ ] **Step 2:** `pnpm exec vitest run lib/sales lib/pedidos`. Esperado: FAIL en las nuevas.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Esperado: PASS completo.
- [ ] **Step 5:** Commit `Descontar y devolver el embalaje en ventas, tienda y pedidos`.

### Task 5: Pedidos de impresión online

**Files:**
- Modify: `apps/fotoffice/lib/impresiones/acreditar-servidor.ts`
- Test: el archivo de pruebas existente de `acreditar-servidor` (o `acreditar-embalaje.test.ts` nuevo si el actual no permite agregar casos sin rehacer su doble)

**Interfaces:**
- Consumes: `planificarConsumo(tx, ws, [], { piezasSinProducto })`, `aplicarConsumo` con `sourceModule: "impresiones"`, `lockStockRows`.

- Solo en la rama donde `cambio.count === 1` (primer paso a `PAGADO`), dentro de la misma transacción: leer los ítems del pedido, armar `PiezaEntrega` `PIEZA_SUELTA` con `widthCm`/`heightCm` y `quantity`, planificar, bloquear `insumoIds` y aplicar con `sourceRef = pedido.id`. Ni en la rama "reemplazado" ni en la de pagos extra del bot.

- [ ] **Step 1: Pruebas que fallan:** 30 copias 10x15 pagadas → `CONSUMO -1` sobre, `sourceModule "impresiones"`; una 50x70 → `CONSUMO -1` bolsa 35x45; segundo pago del bot (`cambio.count === 0`) → ningún movimiento nuevo.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit `Los pedidos de impresión online descuentan su embalaje al pagarse`.

### Task 6: Configurar embalaje (pantalla)

**Files:**
- Create: `apps/fotoffice/app/(shell)/ventas/stock/embalaje/page.tsx`, `apps/fotoffice/app/(shell)/ventas/stock/embalaje/actions.ts`, `apps/fotoffice/app/(shell)/ventas/stock/embalaje/tabla-entregas.tsx` (cliente)
- Create: `apps/fotoffice/lib/stock/embalaje-config.ts` (servidor: leer, guardar, sembrar)
- Modify: `apps/fotoffice/app/(shell)/ventas/stock/page.tsx` (enlace "Embalaje" en las acciones y aviso "N productos sin forma de entrega")
- Test: `apps/fotoffice/lib/stock/embalaje-config.test.ts`

**Interfaces:**
- Produces:
```ts
export const ENVOLTORIOS_DE_EJEMPLO: readonly { nombre: string; tipo: TipoEnvoltorio; admiteAnchoCm: number; admiteAltoCm: number; piezasPorUnidad: number | null; unidad: string }[];
// Sobre de papel 19x24 (admite 15x21, 100, "sobres"); Bolsa negra 20x30 / 30x45 / 35x45 (admiten su medida, "bolsas")
export async function asegurarEnvoltoriosDeEjemplo(workspaceId: string): Promise<{ creados: number }>;
export async function guardarEnvoltorio(workspaceId: string, datos: unknown): Promise<{ ok: true } | { ok: false; error: string }>;
export async function guardarEntregas(workspaceId: string, filas: unknown): Promise<{ ok: true; guardadas: number } | { ok: false; error: string }>;
export async function productosSinEntrega(workspaceId: string): Promise<number>;
```

- Acceso: ver con `requireSalesStaff`, guardar con `requireSalesAdmin` (mismo criterio que `configurarKodak305Action`).
- `asegurarEnvoltoriosDeEjemplo`: idempotente con `pg_advisory_xact_lock(hashtext('fotoffice-embalaje:' || ws))`, como `asegurarKodak305`; crea cada insumo (`Product` `kind INSUMO`, `tracksStock true`, precio 0 + `FotofficeInsumo`) si no existe un insumo con ese nombre, y su `FotofficeEmbalaje`. **Nunca escribe movimientos**: existencia 0. El botón se muestra a cualquier negocio sin envoltorios, con el texto "Cargar sobre 19x24 y bolsas negras".
- Pantalla: arriba, la lista de envoltorios (nombre, sobre/bolsa, "entra hasta AxB", "uno más cada N", activo) con alta y edición. Abajo, la tabla de productos vendibles activos con forma, medida, "bolsa más grande" y envoltorio fijo; las filas sin configurar muestran la sugerencia de `sugerirEntrega` precargada y marcada "sugerido"; **solo se guarda al tocar "Guardar"**. La tabla importa solo de `lib/stock/embalaje.ts` (puro).
- Validación de `guardarEntregas`: producto del negocio y vendible; `PIEZA_SUELTA` admite medida nula; `ENMARCADO` y `VOLUMEN` sin `embalajeFijoId` exigen medida; medidas > 0 y ≤ 300.

- [ ] **Step 1: Pruebas que fallan** de `embalaje-config`: sembrar dos veces crea 4 envoltorios una sola vez; `guardarEntregas` rechaza un producto de otro negocio, un insumo y un `ENMARCADO` sin medida; `productosSinEntrega` cuenta solo vendibles activos sin fila.
- [ ] **Step 2:** Correr. FAIL.
- [ ] **Step 3:** Implementar la biblioteca y las pantallas (`fo-card`, `fo-btn`, `PageHeader`, mismo estilo que `/ventas/stock`).
- [ ] **Step 4:** Correr las pruebas. PASS.
- [ ] **Step 5:** Commit `Pantalla para configurar el embalaje`.

### Task 7: Cambiar el embalaje (Cobrador, pedido, pedido de impresión)

**Files:**
- Modify: `apps/fotoffice/app/(shell)/ventas/actions.ts` (`CheckoutInput.embalaje?: EmbalajeElegido[] | null`; `previsualizarEmbalajeAction`)
- Modify: `apps/fotoffice/app/(shell)/ventas/pos.tsx`
- Create: `apps/fotoffice/components/stock/cambiar-embalaje.tsx` (cliente) y su acción `ajustarEmbalajeAction` en `apps/fotoffice/app/(shell)/ventas/stock/embalaje/actions.ts`
- Modify: la página de detalle del pedido (`app/(shell)/pedidos/[id]/page.tsx`) y la del pedido de impresión (ubicar con `grep -rn "fotofficePrintOrder.findFirst" app`)

**Interfaces:**
- Consumes: `planificarEmbalaje`, `ajustarEmbalaje`, `EmbalajeInvalido`.
- Produces:
```ts
export async function previsualizarEmbalajeAction(lineas: { productId: string | null; qty: number }[]):
  Promise<{ propuesto: (EmbalajeElegido & { nombre: string; motivo: string })[]; opciones: { insumoId: string; nombre: string }[] }>;
export async function ajustarEmbalajeAction(input: { fuente: "pedidos" | "impresiones" | "sales"; ref: string; deseado: EmbalajeElegido[] }):
  Promise<{ ok: true } | { ok: false; error: string }>;
```

- Cobrador, ticket que se lleva todo ahora: debajo del total, línea discreta "Embalaje: 1 sobre 19x24 + 1 bolsa 30x45 · Cambiar" (se recalcula al cambiar renglones, con espera de 300 ms; si el negocio no tiene envoltorios, no aparece). "Cambiar" abre la lista editable (cantidades por envoltorio, sumar otro). Lo editado viaja en `CheckoutInput.embalaje` y `checkoutAction` lo pasa como `{ modo: "manual", elegido }`; sin editar, `undefined` (automático). `EmbalajeInvalido` vuelve como error del cobro.
- Ticket con pedido (`cobrarConPedidoAction`): la línea se muestra con el texto "se descuenta al tomar el pedido; se cambia desde el pedido", sin "Cambiar". *(Decisión: evita repartir un ajuste manual entre venta y pedido.)*
- `CambiarEmbalaje` en el detalle del pedido y del pedido de impresión: muestra lo neto descontado y permite cambiarlo; guarda con `ajustarEmbalajeAction`. Acceso: `pedidos` con el permiso de gestionar el pedido; `impresiones` con el del módulo `print-orders`; `sales` con `requireSalesStaff`. Verificar que el `ref` sea del negocio antes de ajustar.

- [ ] **Step 1:** Implementar las acciones con sus validaciones de acceso y pertenencia.
- [ ] **Step 2:** Implementar la línea del Cobrador y el componente.
- [ ] **Step 3:** `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit -p tsconfig.json`. Esperado: sin errores en los archivos tocados.
- [ ] **Step 4:** Commit `Cambiar el embalaje desde el Cobrador, el pedido y el pedido de impresión`.

### Task 8: Guía, verificación completa y salida a producción

**Files:**
- Create: `apps/fotoffice/lib/instructivos/guias/stock-embalaje.ts`, `apps/fotoffice/lib/instructivos/capturas/stock-embalaje.json`
- Modify: `apps/fotoffice/lib/instructivos/catalogo.ts` (sección Stock), `apps/fotoffice/lib/instructivos/guias/ventas-mostrador.ts` (una línea: la venta también descuenta el embalaje)

- [ ] **Step 1:** Guía `stock-embalaje` siguiendo el formato de `stock-receta-consumo.ts`: cargar los envoltorios, completar la forma de entrega, qué descuenta solo el sistema (ejemplos de §12), cambiar el embalaje en el Cobrador y en un pedido. Las capturas se toman en el negocio de demostración si hay sesión disponible; si no, el JSON describe cada captura y queda anotado como pendiente.
- [ ] **Step 2:** Verificación completa en `apps/fotoffice`:
  `pnpm exec vitest run` → todo verde;
  `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit -p tsconfig.json` → 0 errores;
  `pnpm lint` → sin errores nuevos;
  `NODE_OPTIONS=--max-old-space-size=8192 pnpm build` (con `DATABASE_URL`/`AUTH_SECRET` ficticios si hace falta) → compila.
- [ ] **Step 3:** Probar en el navegador con el servidor local contra una rama Neon descartable (nunca producción): sembrar envoltorios, configurar una 10x15 y un portarretratos, cobrar un ticket y ver los movimientos en Stock, anularlo y ver la devolución.
- [ ] **Step 4:** Aplicar `migration.sql` en producción (rama `development`, `psql -v ON_ERROR_STOP=1` con `DIRECT_URL`), `prisma migrate resolve --applied 20270103120000_fotoffice_stock_embalaje`, verificar en `_prisma_migrations`.
- [ ] **Step 5:** Renombrar la rama a `feat/fotoffice-stock-embalaje`, push, PR con resumen en español y la advertencia "migración ya aplicada en producción". Fusionar cuando los controles estén en verde y verificar que el despliegue de Vercel quede READY.
