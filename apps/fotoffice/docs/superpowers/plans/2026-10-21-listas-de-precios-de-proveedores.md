# Listas de precios de proveedores — etapas 1 y 2 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proveedor preferido, costo y margen por producto; pantalla Costos y márgenes; listas de proveedores por CSV con emparejamiento recordado, vista previa y aplicación.

**Architecture:** Lógica pura en `lib/precios-proveedor/*` (redondeo, margen, CSV, clave, emparejamiento, vista previa, prompt) con pruebas vitest; acceso a base en `lib/precios-proveedor/repositorio.ts` (server-only); pantallas bajo `app/(shell)/ventas/costos/`. Dinero en centavos enteros (`lib/membership/money.ts`).

**Tech Stack:** Next.js (app router, server actions), Prisma 6 (`@repo/db`), papaparse, vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-listas-de-precios-de-proveedores-design.md`

## Global Constraints

- Margen = % sobre el costo (`170` = ×2,7). Precio = `redondearArriba(costo × (1 + margen/100))`.
- Redondeo por omisión: < $5.000 → $100; $5.000–$19.999 → $500; ≥ $20.000 → $1.000. Siempre hacia arriba.
- Nunca se aplica una lista sin vista previa + confirmación. El precio nuevo sale del margen guardado, nunca del precio anterior.
- Sólo cambia costo/precio de un producto si su proveedor preferido es el de la lista.
- Todo con `workspaceId` en el `where`. Permiso: `requireSalesAdmin`.
- Migración a mano, idempotente, aplicada en producción antes del merge.
- `"use server"` sólo exporta funciones async. `tsc` con `NODE_OPTIONS=--max-old-space-size=8192`. Los tests entran al chequeo de tipos.

## Review Focus

- CSV con `$`, puntos de miles, espacios internos (`$10 .200`) y comillas → precio 10200, no error.
- Producto sin costo o costo 0 al calibrar → no se calibra (no división por cero), queda marcado.
- Proveedor "ROMAN" en texto libre vs "Román" en la lista → se unen (sin tildes/mayúsculas).
- Lista emparejada a un producto cuyo preferido es otro proveedor → no toca el producto.
- Dos renglones al mismo producto → el segundo reemplaza al primero (única equivalencia por producto).

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (Product, FotofficeProveedor, Workspace relations + 4 modelos nuevos)
- Create: `packages/db/prisma/migrations/20261130120000_fotoffice_listas_precios_proveedores/migration.sql`

**Produces:** `Product.preferredProveedorId String?`, `Product.marginPct Decimal(7,2)?`, `Product.costUpdatedAt DateTime?`; modelos `FotofficeReglaPrecios { workspaceId @unique, redondeo Json, fotolibroMarginPct Decimal(7,2)? }`, `FotofficeListaProveedor { id, workspaceId, proveedorId, vigencia, nombreArchivo?, estado @default("BORRADOR"), creadaPorUserId Int?, aplicadaPorUserId Int?, aplicadaAt?, createdAt, updatedAt }`, `FotofficeListaProveedorItem { id, listaId (Cascade), fila Int, tipo, categoria, producto, modelo?, medida?, variante?, cantidadMinima Int?, unidad, costoArs Decimal(12,2), codigoProveedor?, notas?, clave, productId? (SetNull), factor Decimal(10,4) @default(1) }`, `FotofficeEquivalenciaProveedor { id, workspaceId, proveedorId, clave, productId (Cascade), factor Decimal(10,4) @default(1), @@unique([workspaceId, proveedorId, clave]), @@unique([workspaceId, proveedorId, productId]) }`.

- [ ] Editar schema; SQL con `IF NOT EXISTS` para columnas, tablas, índices y FKs (FK en bloque `DO $$ … EXCEPTION WHEN duplicate_object`).
- [ ] `pnpm db:generate` en `packages/db`. Expected: sin errores.
- [ ] Commit.

### Task 2: Redondeo y margen (puro)

**Files:** Create `lib/precios-proveedor/redondeo.ts`, `lib/precios-proveedor/margen.ts`, tests `.test.ts` al lado.

**Produces:**
- `type TramoRedondeo = { desdeMinor: number; multiploMinor: number }`
- `TRAMOS_POR_OMISION: TramoRedondeo[]` = `[{0,10000},{500000,50000},{2000000,100000}]` (centavos)
- `redondearArriba(minor: number, tramos: TramoRedondeo[]): number`
- `leerTramos(raw: unknown): TramoRedondeo[]` (inválido → por omisión)
- `validarTramos(raw: unknown): { ok: true; tramos } | { ok: false; error: string }` (orden creciente, primer `desde` 0, múltiplo > 0)
- `precioSugeridoMinor(costMinor: number, marginPct: number, tramos): number`
- `calibrarMargenPct(priceMinor: number, costMinor: number | null): number | null` (2 decimales; null si costo nulo/0)

- [ ] Tests: `redondearArriba(310000)` → 310000; `310001` → 320000; `720000` → 750000; `2760000` → 2760000; `2760001` → 2800000; `450000`(4.500) → 450000. `precioSugeridoMinor(265000, 170)` → 750000 (2.650 × 2,7 = 7.155 → 7.500). `calibrarMargenPct(720000, 265000)` → 171.7; `calibrarMargenPct(100, 0)` → null.
- [ ] Implementar; tests verdes; commit.

### Task 3: CSV, clave y prompt (puro)

**Files:** Create `lib/precios-proveedor/csv.ts`, `clave.ts`, `prompt.ts` + tests.

**Produces:**
- `TIPOS_RENGLON = ["PRODUCTO","TAPA","HOJA","CAJA","ADICIONAL"] as const`
- `type RenglonLista = { fila: number; proveedor: string; vigencia: string; tipo; categoria: string; producto: string; modelo: string|null; medida: string|null; variante: string|null; cantidadMinima: number|null; unidad: string; costoMinor: number; codigoProveedor: string|null; notas: string|null; clave: string }`
- `analizarCsvLista(texto: string): { renglones: RenglonLista[]; errores: { fila: number; error: string }[]; duplicadas: number; vigencia: string | null }` — acepta el CSV pegado dentro de un bloque ```` ``` ````; encabezado tolerante (mayúsculas, tildes, espacios); duplicado por clave → gana el último; tope 3.000 renglones; precio entero 1..9.999.999 tras limpiar `$`, `.`, espacios.
- `normalizarTexto(s: string): string` (minúsculas, sin tildes, espacios simples, trim)
- `claveRenglon(r: Pick<RenglonLista, "tipo"|"categoria"|"producto"|"modelo"|"medida"|"variante"|"cantidadMinima">): string`
- `promptParaChatGpt(nombreProveedor: string): string` — texto exacto de spec §6.2 con el nombre.

- [ ] Tests: precio `"$10 .200"` → 1020000; fila con `tipo` "foo" → error con número de fila; encabezado `"Proveedor, Vigencia,…"` aceptado; CSV envuelto en ```` ```csv ```` aceptado; duplicados cuentan 1; prompt contiene el encabezado exacto y el nombre.
- [ ] Implementar con papaparse (patrón `lib/clients/importar.ts`); verde; commit.

### Task 4: Emparejamiento, vista previa y proveedor desde texto (puro)

**Files:** Create `lib/precios-proveedor/emparejar.ts`, `vista-previa.ts` + tests.

**Produces:**
- `medidaDe(texto: string): string | null` — primer `NxM` (normaliza `20 x 30`, `20X30` → `20x30`; orden menor primero).
- `sugerirProducto(r: RenglonLista, productos: { id: string; name: string; categoryName: string | null }[]): string | null` — candidatos con la misma medida; puntaje por palabras compartidas (normalizadas, ≥3 letras) entre `producto+categoria+variante` y `name+categoryName`; null si no hay medida común o empate en 0.
- `proveedorDesdeTexto(texto: string | null, proveedores: { id: string; name: string }[]): string | null`
- `type FilaVistaPrevia = { productId; nombre; costoAntesMinor: number|null; costoNuevoMinor: number; precioAntesMinor: number; precioNuevoMinor: number; marginPct: number|null; marcas: ("SIN_MARGEN"|"BAJA"|"SUBE_MUCHO"|"OTRO_PROVEEDOR"|"VARIANTES")[] }`
- `armarVistaPrevia(items: { productId: string; costoMinor: number; factor: number }[], productos: Map<string, { name; costMinor: number|null; priceMinor: number; marginPct: number|null; preferredProveedorId: string|null; variantesConPrecio: boolean }>, proveedorId: string, tramos): FilaVistaPrevia[]` — costo nuevo = round(costo × factor); SUBE_MUCHO si > 30 %; OTRO_PROVEEDOR deja precio/costo iguales.

- [ ] Tests: "Ampliación 20x40" elige ese y no "Cuadro canvas 40x60"; "ROMAN" → id de "Román"; vista previa con margen 170 y costo 2650 → 7500; preferido distinto → OTRO_PROVEEDOR y precioNuevo = precioAntes; factor 0,6 aplicado.
- [ ] Implementar; verde; commit.

### Task 5: Repositorio (server)

**Files:** Create `lib/precios-proveedor/repositorio.ts`.

**Consumes:** Tasks 1–4. **Produces:**
- `leerTramosWorkspace(workspaceId): Promise<TramoRedondeo[]>`; `guardarTramos(workspaceId, tramos)`
- `type FilaCosto = { id; name; categoryName; supplierName; preferredProveedorId; costMinor|null; priceMinor; marginPct|null; precioSugeridoMinor|null; variantesConPrecio: boolean }`
- `listarFilasCosto(workspaceId, f: { categoryId?; proveedorId?; soloSinCosto? }): Promise<FilaCosto[]>` (activos)
- `guardarFilaCosto(workspaceId, productId, cambios: { preferredProveedorId?: string|null; costMinor?: number|null; marginPct?: number|null })` — si cambia costo o margen y quedan ambos, recalcula `priceArs` con tramos; setea `costUpdatedAt` si cambia costo; valida proveedor del workspace.
- `asignarProveedorMasivo(workspaceId, productIds, proveedorId|null)`
- `calibrarMargenes(workspaceId, productIds): Promise<{ calibrados: number; sinCosto: number }>` (no cambia precio)
- `aplicarPrecioSugerido(workspaceId, productIds): Promise<number>`
- `sugerenciasUnionProveedores(workspaceId): Promise<{ texto: string; productos: number; proveedorId: string|null }[]>` y `unirProveedores(workspaceId, pares: { texto: string; proveedorId: string|null; crearConNombre?: string }[])` (sólo productos sin preferido)
- `crearLista(workspaceId, userId, proveedorId, nombreArchivo, analisis)` → id; empareja con equivalencias (clave o `codigoProveedor`) y si no, `sugerirProducto`
- `leerLista(workspaceId, listaId)`; `listarListas(workspaceId)`
- `emparejarItem(workspaceId, itemId, productId|null, factor)` — guarda en item y upsert equivalencia (borra otra equivalencia del mismo producto+proveedor)
- `vistaPreviaLista(workspaceId, listaId): Promise<FilaVistaPrevia[]>`
- `aplicarLista(workspaceId, listaId, userId)` — transacción; recalcula vista previa adentro; escribe costo/precio/costUpdatedAt; estado APLICADA; rechaza si no es BORRADOR
- `descartarLista(workspaceId, listaId)`

- [ ] Implementar; typecheck filtrado a estos archivos; commit.

### Task 6: Pantalla Costos y márgenes + menú

**Files:** Create `app/(shell)/ventas/costos/page.tsx`, `tabla-costos.tsx` (client), `redondeo-form.tsx` (client), `union-proveedores.tsx` (client), `actions.ts`. Modify `lib/modules/submodules.ts` (entrada después de Stock: `/ventas/costos`, "Costos y márgenes", icon `Calculator`, `requiresManage: true`, `requiresAction: SALES_CATALOG_ACTION` si el tipo lo admite, `activeMatch: "under"`), `components/shell/nav-icons.ts` si falta el ícono, `lib/shell/nav-keywords.ts`.

- [ ] Tabla con filtros (categoría, proveedor, sin costo), selección múltiple, edición en línea de costo y margen (guarda al salir del campo), selector de preferido por fila y masivo, botones "Calibrar margen" y "Aplicar precio sugerido" (este con confirmación que lista cambios). Sección Redondeo. Aviso de unión de proveedores si hay productos con texto y sin preferido. Enlace a "Listas de proveedores".
- [ ] Probar en `next dev --webpack` con un workspace de prueba local o revisión de render; commit.

### Task 7: Listas de proveedores (pantallas)

**Files:** Create `app/(shell)/ventas/costos/listas/page.tsx` (historial + nueva lista: elegir proveedor, copiar prompt, subir/pegar CSV), `nueva-lista.tsx` (client), `app/(shell)/ventas/costos/listas/[listaId]/page.tsx` + `emparejar-lista.tsx` (client) + `actions.ts`.

- [ ] Nueva: proveedor → prompt con botón Copiar → archivo .csv o texto → `crearListaAction` → redirige a la lista.
- [ ] Lista: errores del CSV arriba; tabla de renglones con producto sugerido/recordado (selector buscable por nombre) y factor; vista previa con marcas; botones Aplicar (confirmación) y Descartar. Aplicada → sólo lectura.
- [ ] Commit.

### Task 8: Ficha de producto y Alboom

**Files:** Modify `lib/sales/product-form.ts` (+ `preferredProveedorId: string|null`), `app/(shell)/ventas/product-form.tsx` (selector proveedor preferido; margen y precio sugerido como dato), `app/(shell)/ventas/actions.ts` (`saveProductAction`: guarda preferido validando workspace; si el precio cambió y hay costo y margen → recalibra margen con `calibrarMargenPct`), `lib/sales/repository.ts` (`ProductDetail` + `preferredProveedorId`, `marginPct`), página de ficha (pasar proveedores), `lib/alboom/carga/repositorio-prisma.ts` (no pisar `costArs`/`priceArs` si `marginPct` no es nulo).

- [ ] Test en `product-form.test.ts`: `preferredProveedorId` vacío → null.
- [ ] Implementar; commit.

### Task 9: Verificación y despliegue

- [ ] `pnpm --filter fotoffice test` verde; `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit -p tsconfig.json` sin errores; `pnpm --filter fotoffice lint` sobre archivos tocados; `pnpm --filter fotoffice build` con env ficticio.
- [ ] Aplicar migración en cada base que tenga `Product` (verificar con `to_regclass('"Product"')`), registrar en `_prisma_migrations` con checksum del archivo.
- [ ] PR, CI verde, merge, deployment Ready, pantalla responde.
- [ ] Puesta en marcha DNX Estudio (spec §11): unir proveedores, subir lista La Isla, emparejar, aplicar costos, calibrar los de La Isla.
