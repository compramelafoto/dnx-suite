# Preparar para laboratorio — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el Cobrador, la cajera sube muchas fotos, elige por foto medida, plazo, papel, cantidad y recorte; el ticket se arma solo (un renglón por producto) y, al cobrar, cada trabajo sale a su laboratorio con un ZIP fiel al recorte, un solo correo y nunca vacío.

**Architecture:** Se extiende la *preparación* de `lib/impresion` con un destino `LABORATORIO` (piezas con medida/plazo/papel). Al cobrar con pedido se crea un `FotofficePrintOrder` `source = "MOSTRADOR"` ya `PAGADO` cuyos ítems apuntan a las piezas y a los trabajos recién creados; el cron existente `prepararPedido` arma el ZIP (con la receta completa vía `renderizarPieza`), manda el correo y mueve el trabajo. `enviarTrabajosDelPedidoAlProveedor` deja de mandar copias con carpeta vacía.

**Tech Stack:** Next.js (App Router, server actions), Prisma/Postgres (Neon), sharp, R2 privado, Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-30-preparar-para-laboratorio-design.md`

## Global Constraints

- Textos de pantalla en español rioplatense (vos), sin jerga; «dinero», nunca «plata».
- Límites: `FOTOS_MAX_LAB = 200` fotos por preparación, `CANTIDAD_MAX_LAB = 99` copias por foto.
- Plazos ofrecidos: `MANANA` y `SEMANA` (nunca `INSTANTANEA`). Papeles: `MATE` y `BRILLO`, filtrados por `FotofficePrintSettings.paperMatte/paperGlossy` (sin fila: los dos).
- Medidas reales en mm: 10x15 = 102×152, 13x18 = 127×180, 15x21 = 152×210, 20x30 = 203×300, 25x38 = 254×380; cualquier otra «AxB» = A·10 × B·10 mm.
- Archivo final: medida real a 300 ppp, nunca más píxeles que los que da el original para ese encuadre; JPEG q95, 4:4:4, sRGB.
- Laboratorio de cada renglón: `FotofficeProductoProyecto.proveedorId` → si no, `Product.preferredProveedorId`; renglón de pocas copias: el del producto «para mañana» de esa medida. El mismo id va al trabajo y a cada ítem del pedido de impresión.
- El pedido `MOSTRADOR` no llama `avisarPedidoConfirmado`, no tiene `email`, no mueve Caja.
- Migración a mano: SQL en `packages/db/prisma/migrations/<ts>_fotoffice_preparar_laboratorio/`, aplicada con `psql -v ON_ERROR_STOP=1` contra `DIRECT_URL` de `apps/fotoffice/.env.local` y registrada con `prisma migrate resolve --applied`.
- El typecheck local miente (cliente Prisma viejo): correr `pnpm --filter @repo/db exec prisma generate` antes de `tsc`, o confiar en el build de Vercel del PR.

## Review Focus

1. **Cobro repetido** (doble clic / reintento con la misma `clave`): no crea un segundo pedido de impresión ni duplica ítems → test en Task 6.
2. **Ticket manipulado o desactualizado** (el navegador manda cantidades/precios que no coinciden con las piezas guardadas): el servidor rechaza con «Las fotos cambiaron: tocá el pedido para laboratorio y volvé a cobrar.» → test en Task 6.
3. **Foto sin terminar de subir o borrada antes de cobrar** (original PENDIENTE): no cuenta para renglones ni para el pedido → test en Task 3.
4. **Producto de copia sin regla de proceso** (no crea trabajo): el cobro avisa «Configurá el flujo de [producto] en el catálogo: sin él no se puede mandar al laboratorio.» y no crea el pedido de impresión → test en Task 6.
5. **Original más chico que la medida** (pixelado): el render no agranda y el correo lo lista como baja calidad (`calidadBaja`) → test en Task 7.

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `FotofficePreparacionImpresion`, `FotofficePiezaImpresion`, `FotofficePrintOrderItem`)
- Create: `packages/db/prisma/migrations/20270110120000_fotoffice_preparar_laboratorio/migration.sql`

**Interfaces — Produces:**
- `FotofficePreparacionImpresion.destino String @default("LOCAL")` — `LOCAL | LABORATORIO` (CHECK).
- `FotofficePiezaImpresion.medida String?`, `plazo String?` (`MANANA|SEMANA`, CHECK), `papel String?` (`MATE|BRILLO`, CHECK).
- `FotofficePrintOrderItem.piezaId String?` + `@@index([piezaId])` (sin relación, como `archivoId`).

- [ ] **Step 1:** Agregar las columnas al schema con un `///` que diga para qué son.
- [ ] **Step 2:** Escribir el SQL idempotente (`ADD COLUMN IF NOT EXISTS`, CHECK dentro de `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint …)`), igual que `20270102120000_fotoffice_impresion_whatsapp`.
- [ ] **Step 3:** `pnpm --filter @repo/db exec prisma validate` → «The schema … is valid».
- [ ] **Step 4:** `pnpm --filter @repo/db exec prisma generate` → sin errores.
- [ ] **Step 5:** Commit «Esquema: preparaciones para laboratorio».

### Task 2: Reglas puras del pedido de laboratorio

**Files:**
- Create: `apps/fotoffice/lib/impresion/laboratorio.ts`, `apps/fotoffice/lib/impresion/laboratorio.test.ts`

**Interfaces:**
- Consumes: `cotizarCopias`, `ProductoCopia`, `Plazo` de `lib/impresiones/catalogo-copias.ts`; `Papel` (mm) de `lib/impresion/encuadre.ts`.
- Produces:
  - `export const FOTOS_MAX_LAB = 200; export const CANTIDAD_MAX_LAB = 99;`
  - `export type PlazoLab = "MANANA" | "SEMANA"; export type PapelLab = "MATE" | "BRILLO";`
  - `export function medidaEnMm(medida: string): Papel | null`
  - `export type PiezaLab = { originalId: string; medida: string; plazo: PlazoLab; papel: PapelLab; cantidad: number };`
  - `export type OpcionesLab = { medidas: { medida: string; plazos: PlazoLab[] }[]; papeles: PapelLab[] };`
  - `export function opcionesDelCatalogo(catalogo: ProductoCopia[], papeles: { mate: boolean; brillo: boolean } | null): OpcionesLab`
  - `export type RenglonLab = { productId: string; cantidad: number; precioUnitario: number; proveedorId: string | null; claves: string[] };` — `claves` = `${medida}|${plazoFinal}` de las piezas que cubre.
  - `export function renglonesDelPedido(piezas: PiezaLab[], catalogo: ProductoCopia[], proveedorDeProducto: Map<string, string | null>): { ok: true; renglones: RenglonLab[]; plazoFinal: Map<string, PlazoLab> } | { ok: false; error: string }` — `plazoFinal` por `originalId`.

- [ ] **Step 1: Tests** (`laboratorio.test.ts`):
  - `medidaEnMm("10x15")` → `{ anchoMm: 102, altoMm: 152 }`; `"25x38"` → `254×380`; `"30x45"` → `300×450`; `"abc"` → `null`.
  - `opcionesDelCatalogo` excluye `INSTANTANEA`, ordena medidas por lado corto y largo, y con `{ mate: false, brillo: true }` devuelve `papeles: ["BRILLO"]`; con `null`, `["MATE","BRILLO"]`.
  - `renglonesDelPedido` con 24 copias 10x15 SEMANA (catálogo con «más de 10» SEMANA) → un renglón con ese producto, `cantidad: 24`.
  - Mismas piezas en MATE y BRILLO → **un** renglón (el papel no separa productos).
  - 3 copias 13x18 SEMANA + 2 copias 13x18 MANANA, sin escalón alcanzado → **un** renglón del producto instantáneo 13x18, `cantidad: 5`, `proveedorId` = el del producto MANANA 13x18, y `plazoFinal` = `MANANA` para todas esas piezas.
  - Medida sin producto → `{ ok: false, error: "No hay precio para 40x60 próxima semana en el catálogo." }`.
  - `proveedorDeProducto` con valor para el producto gana sobre `ProductoCopia.proveedorId`.
- [ ] **Step 2:** `pnpm --filter fotoffice exec vitest run lib/impresion/laboratorio.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Agrupar por `medida|plazo` → `cotizarCopias` con una línea por grupo → juntar las líneas que caen en el mismo `productoId` sumando cantidades (allí cae el caso de pocas copias en dos plazos). El error usa `nombreDelPlazo`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit «Reglas del pedido de laboratorio».

### Task 3: Servidor de la preparación de laboratorio

**Files:**
- Create: `apps/fotoffice/lib/impresion/laboratorio-servidor.ts`, `apps/fotoffice/lib/impresion/laboratorio-servidor.test.ts`
- Modify: `apps/fotoffice/lib/impresion/preparaciones.ts` (`pedirSubidaOriginal`: tope `FOTOS_MAX_LAB` si `destino === "LABORATORIO"`; `crearPreparacion` no cambia)
- Modify: `apps/fotoffice/app/(shell)/ventas/impresion/actions.ts` (acciones nuevas)

**Interfaces — Produces:**
- `crearPreparacionLaboratorio(ctx: CtxImpresion, d: { clientId: string | null }): Promise<R<{ id: string }>>` — `productId: null`, `destino: "LABORATORIO"`.
- `type FotoLab = { originalId: string; nombre: string; vista: string | null; ancho: number; alto: number; pieza: (PiezaLab & { receta: Receta; revisada: boolean }) | null };`
- `type EstadoLab = { preparacionId: string; fotos: FotoLab[]; opciones: OpcionesLab };`
- `estadoLaboratorio(ctx, preparacionId: string): Promise<EstadoLab | null>` — sólo originales `LISTO`.
- `guardarPiezasLaboratorio(ctx, preparacionId: string, items: { originalId: string; medida: unknown; plazo: unknown; papel: unknown; cantidad: unknown; receta: unknown; revisada: boolean }[]): Promise<R<{ guardadas: number }>>` — valida medida contra `opciones`, `cantidad` 1..`CANTIDAD_MAX_LAB`, `validarReceta`; upsert de una pieza `tipo: "COPIA"` por original con `huella` como `guardarPiezasCopia`.
- `quitarFotoLaboratorio(ctx, preparacionId: string, originalId: string): Promise<R>`.
- `renglonesDeLaPreparacion(workspaceId: string, preparacionId: string): Promise<{ ok: true; renglones: RenglonLab[]; plazoFinal: Map<string, PlazoLab>; piezas: { id: string; originalId: string; medida: string; papel: PapelLab; cantidad: number }[] } | { ok: false; error: string }>` — exige ≥1 pieza y que **toda** foto `LISTO` tenga pieza; si no: «Hay fotos sin tamaño: completalas o quitalas.».
- Acciones: `crearPreparacionLaboratorioAction`, `estadoLaboratorioAction`, `guardarPiezasLaboratorioAction`, `quitarFotoLaboratorioAction`, `listoLaboratorioAction(preparacionId) → R<{ renglones: { productId: string; nombre: string; cantidad: number; precioUnitarioMinor: number }[] }>`.
- El catálogo se lee como en el bot (`leerProductosDeCopia` sobre productos activos del workspace); `proveedorDeProducto` desde `FotofficeProductoProyecto.proveedorId` (primera regla por `order`) con respaldo `Product.preferredProveedorId`.

- [ ] **Step 1: Tests** siguiendo el patrón de base falsa de `lib/impresion/copias.test.ts`:
  - `guardarPiezasLaboratorio` rechaza medida que no está en el catálogo («Elegí un tamaño de la lista.») y cantidad 100.
  - `renglonesDeLaPreparacion` ignora originales `PENDIENTE` y falla con una foto `LISTO` sin pieza.
  - `pedirSubidaOriginal` en una preparación LABORATORIO con 200 originales → «Un pedido para laboratorio admite hasta 200 fotos.».
  - Preparación de otro workspace → «Esa preparación ya no existe…» (el mensaje `NO_EXISTE` actual).
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. Las acciones usan el mismo contexto que `crearPreparacionAction` (módulo de ventas).
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit «Preparaciones de laboratorio en el servidor».

### Task 4: Editor «Pedido para laboratorio»

**Files:**
- Create: `apps/fotoffice/components/copias/editor-laboratorio.tsx`, `apps/fotoffice/components/copias/tarjeta-foto-lab.tsx`
- Modify (si hace falta exportar piezas): `apps/fotoffice/components/copias/editor-una-foto.tsx`

**Interfaces:**
- Consumes: acciones de Task 3; `EditorUnaFoto` (con `papel = medidaEnMm(medida) + nombre`); `propuestaAutomatica`, `calidadDeCopia`; `SUBIDAS_A_LA_VEZ`, `conLimite`, `validarArchivoFoto`; `pedirSubidaOriginalAction`, `confirmarOriginalAction`.
- Produces: `export function EditorLaboratorio({ preparacionId, onListo, onCerrar }: { preparacionId: string; onListo: (renglones: RenglonTicketLab[]) => void; onCerrar: () => void })` con `type RenglonTicketLab = { productId: string; nombre: string; cantidad: number; precioUnitarioMinor: number }` exportado desde `editor-laboratorio.tsx`.

Pantalla (copiar estructura y estilos de `EditorCopias`):
- Arriba: «Para las fotos nuevas:» medida · plazo · papel · cantidad (lo que reciben las fotos al subir). Botón «Agregar fotos» + zona de arrastre.
- Grilla de `TarjetaFotoLab`: miniatura, «10x15 · mate · ×2 · próxima semana», aviso «Pixelada» con `calidadDeCopia`, casilla para elegir, quitar.
- Con fotos elegidas: barra «A las elegidas:» con los cuatro selectores y «Aplicar».
- Tocar una foto abre `EditorUnaFoto` (recorte, girar, encajar).
- Pie: resumen por medida/papel/plazo y total en pesos (de `listoLaboratorioAction` en vivo no: el total aparece al tocar «Listo»; el resumen muestra copias por medida). Botón «Listo» → `listoLaboratorioAction`; error en rojo arriba del botón.

- [ ] **Step 1:** Construir los componentes.
- [ ] **Step 2:** Verificar en el navegador con el servidor local (Task 5 lo monta): subir 3 JPG, cambiar en lote, abrir una foto, «Listo» devuelve renglones.
- [ ] **Step 3:** Commit «Editor del pedido para laboratorio».

### Task 5: El Cobrador

**Files:**
- Modify: `apps/fotoffice/app/(shell)/ventas/pos.tsx`
- Create: `apps/fotoffice/app/(shell)/ventas/dialogo-laboratorio.tsx`
- Modify: `apps/fotoffice/app/(shell)/ventas/actions.ts` (si `produccionDeProductosAction` no sirve, acción `hayCopiasDeLaboratorioAction(): Promise<boolean>`)

**Interfaces:**
- Consumes: `EditorLaboratorio`, `RenglonTicketLab`, `crearPreparacionLaboratorioAction`.
- Produces (estado del POS): `const [laboratorio, setLaboratorio] = useState<{ preparacionId: string; keys: string[] } | null>(null)`. Cada renglón del grupo lleva `paraRetirar` implícito (va al pedido) y queda **bloqueado**: sin edición de cantidad/precio ni quitar uno; un solo botón «Quitar pedido para laboratorio» borra el grupo y anula la preparación (`anularPreparacion`).
- `cobrarConPedidoAction` recibe `laboratorio: { preparacionId: string } | null` y cada línea del grupo `paraLaboratorio: true` (Task 6).

- [ ] **Step 1:** Botón «Pedido para laboratorio» junto a «Producto suelto», visible sólo si hay copias de laboratorio en el catálogo.
- [ ] **Step 2:** Primer toque crea la preparación; los siguientes reabren la misma. `onListo` reemplaza los renglones del grupo por los nuevos.
- [ ] **Step 3:** Con grupo de laboratorio el cobro va siempre por `cobrarConPedidoAction` (exige cliente con el mensaje actual). El bloqueo «Las fotos preparadas se cobran solas» se mantiene para preparaciones Kodak/carnet y no aplica al grupo.
- [ ] **Step 4:** `reiniciarTicket` limpia `laboratorio`. Deshacer (`historialRef`) no puede dejar renglones del grupo sueltos: si el historial vuelve a un estado sin el grupo, se limpia `laboratorio` también.
- [ ] **Step 5:** Mensaje después de cobrar: «Las fotos se preparan y el pedido sale solo a [laboratorios] en unos minutos.» (nombres que devuelve la acción).
- [ ] **Step 6:** Verificar en el navegador (servidor local con base de prueba, nunca producción): armar pedido, ver renglones bloqueados, reabrir y cambiar, quitar grupo.
- [ ] **Step 7:** Commit «Cobrador: pedido para laboratorio».

### Task 6: Cobro: pedido de impresión de mostrador

**Files:**
- Modify: `apps/fotoffice/app/(shell)/ventas/pedido-actions.ts`
- Create: `apps/fotoffice/lib/impresiones/mostrador-servidor.ts`, `apps/fotoffice/lib/impresiones/mostrador-servidor.test.ts`

**Interfaces:**
- Consumes: `renglonesDeLaPreparacion` (Task 3); `medidaEnMm` (Task 2).
- Produces:
  - `LineaMostrador.paraLaboratorio?: boolean`; `CobroConPedidoInput.laboratorio?: { preparacionId: string } | null`; `CobroConPedidoResult` ok suma `laboratorios: string[]`.
  - `comprobarTicketDeLaboratorio(workspaceId: string, preparacionId: string, lineas: { productId: string | null; qty: number; unitPriceMinor: number }[]): Promise<{ ok: true; renglones: RenglonLab[] } | { ok: false; error: string }>` — las líneas del grupo deben coincidir exactamente (producto, cantidad, precio en centavos) con `renglonesDeLaPreparacion`; si no: «Las fotos cambiaron: tocá el pedido para laboratorio y volvé a cobrar.».
  - `crearPedidoDeMostrador(d: { workspaceId: string; preparacionId: string; pedidoId: string; clientId: string; nombreCliente: string; lineasDelPedido: { productId: string | null; itemIndex: number }[] }): Promise<{ ok: true; numero: number; laboratorios: string[] } | { ok: false; error: string }>` — idempotente por preparación: si ya hay un `FotofficePrintOrder` con `pricingSnapshot.preparacionId` igual, devuelve ese.

Comportamiento:
- En `cobrarConPedidoAction`, **antes** de crear el pedido: si `laboratorio`, `comprobarTicketDeLaboratorio`; y cada producto del grupo debe tener `FotofficeProductoProyecto`, si no: «Configurá el flujo de [producto] en el catálogo: sin él no se puede mandar al laboratorio.».
- **Después** de crear el pedido (también en `alta.repetido`): `crearPedidoDeMostrador`. Busca los trabajos por `pedidoId` y `pedidoItemIndex` (índice dentro de `delPedido`); a cada trabajo le escribe el `proveedorId` del renglón; crea el `FotofficePrintOrder` con: número con el mismo `pg_advisory_xact_lock` que `whatsapp-servidor.ts`, `source: "MOSTRADOR"`, `status: "PAGADO"`, `paidAt: ahora`, `clientId`, `nombre`, `email: null`, `paper` = papel de la primera pieza, `delivery: "RETIRO"`, montos en 0, `pricingSnapshot: { origen: "mostrador", preparacionId, pedidoId }`, `trackingToken` aleatorio; un ítem por pieza con `sourceKey` = `original.key`, `sourceName` = nombre del original, `widthCm/heightCm` = mm/10, `quantity`, `paper`, `plazo` = `plazoFinal`, `proveedorId`, `proyectoId`, `piezaId`, `crop*` = 0,0,1,1, precios en 0, `calidadBaja` si `calidadDeCopia` da «PIXELADA».
- Marca la preparación `estado: "LISTA"` (deja de ser editable).
- Si falla después del cobro: el cobro no se deshace; `aviso` = «El pedido [N] quedó cobrado, pero las fotos no se prepararon: [error]. Avisá a sistemas.» y log con `console.error("[cobrador][laboratorio]", …)`.

- [ ] **Step 1: Tests** (`mostrador-servidor.test.ts`, base falsa como `whatsapp-servidor.test.ts`):
  - Ítems con `proyectoId` del trabajo de su renglón y `proveedorId` igual al del trabajo.
  - Dos llamadas con la misma preparación → un solo `FotofficePrintOrder`.
  - `comprobarTicketDeLaboratorio` con una cantidad cambiada → error exacto de arriba.
  - Producto sin regla → error exacto de arriba (test sobre la función que lo chequea, exportada desde `mostrador-servidor.ts`: `productosSinFlujo(workspaceId, productIds): Promise<string[]>`).
  - El pedido nace sin `email` y con `status: "PAGADO"`.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit «Cobro con pedido para laboratorio».

### Task 7: Recorte fiel en `prepararPedido`

**Files:**
- Modify: `apps/fotoffice/lib/impresiones/preparar-servidor.ts`
- Create: `apps/fotoffice/lib/impresion/render-laboratorio.ts`, test `render-laboratorio.test.ts`
- Modify: `apps/fotoffice/lib/impresiones/preparar-servidor.test.ts`

**Interfaces — Produces:**
- `pixelesParaLaboratorio(papel: Papel, receta: Receta, original: { ancho: number; alto: number }): { ancho: number; alto: number }` — pura: medida a 300 ppp, achicada proporcionalmente si el encuadre (`planDeRecorte`/`rectanguloEnPixeles`) da menos píxeles.
- `renderParaLaboratorio(original: Buffer, receta: Receta, papel: Papel): Promise<Buffer>` — `renderizarPieza` + JPEG q95 4:4:4 sRGB.
- En `prepararPedido`, `recortar` por omisión: si `item.piezaId`, lee la pieza (`receta`, `medida`) y usa `renderParaLaboratorio`; si no, `recortarParaImprimir` como hoy.

- [ ] **Step 1: Tests**: 10x15 con original de 4000×6000 → `1205×1795` (102/152 mm a 300 ppp redondeado como `mmAPx`); original de 600×900 → no supera 600×900; ítem con `piezaId` llama al render con receta (dep inyectada) y sin `piezaId` sigue usando el recorte simple.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit «Pedidos de mostrador: el laboratorio imprime el recorte de la cajera».

### Task 8: Sin correos vacíos

**Files:**
- Modify: `apps/fotoffice/lib/proyectos/proveedor.ts` (`enviarTrabajosDelPedidoAlProveedor`)
- Test: `apps/fotoffice/lib/proyectos/proveedor.test.ts` (crear si no existe)

**Interfaces — Produces:** `export function seMandaAlCobrar(t: { esCopia: boolean; esDeMostrador: boolean; archivosListos: number; esFotolibro: boolean }): boolean` (pura) — false si fotolibro, si es de mostrador, o si es copia y `archivosListos === 0`.

- [ ] **Step 1: Tests** de `seMandaAlCobrar` (las 4 combinaciones) y de que un trabajo omitido por carpeta vacía recibe la nota «Falta subir los archivos para mandarlo a [laboratorio].» y queda con `proveedorEnviadoAt: null`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar: `esCopia` con `leerProductosDeCopia([{ name, … }]).length > 0`; `esDeMostrador` = existe `FotofficePrintOrderItem` con ese `proyectoId`; `archivosListos` = count de `FotofficeArchivoTrabajo` `LISTO`. **Step 4:** PASS.
- [ ] **Step 5:** Commit «No mandar al laboratorio copias sin archivos».

### Task 9: Pantallas y guías

**Files:**
- Modify: la lista de pedidos de impresión (Configuración → Impresiones, «Pedidos pagados sin enviar» y la que muestre pedidos): etiqueta «Mostrador» y sin montos para `source === "MOSTRADOR"`.
- Create: `apps/fotoffice/lib/instructivos/guias/mostrador-pedido-laboratorio.ts` (sección «Mostrador», `moduleKey: "sales"`), registrar en `catalogo.ts` después de `fotoCarnet`.
- Modify: `apps/fotoffice/lib/instructivos/guias/trabajos-enviar-al-proveedor.ts` (paso «Cuándo se hace a mano»: las copias desde el Cobrador salen solas con «Pedido para laboratorio»; las copias sin archivos ya no se mandan vacías).

- [ ] **Step 1:** Cambios. **Step 2:** `pnpm --filter fotoffice exec vitest run lib/instructivos` → PASS. **Step 3:** Commit «Guías del pedido para laboratorio».

### Task 10: Verificación y producción

- [ ] **Step 1:** `pnpm --filter fotoffice exec vitest run lib/impresion lib/impresiones lib/proyectos lib/instructivos` → todo PASS.
- [ ] **Step 2:** PR; esperar `tipos-y-pruebas` y el build de Vercel de fotoffice en verde.
- [ ] **Step 3:** Aplicar la migración en producción (`psql` + `migrate resolve`), verificar columnas con `\d "FotofficePiezaImpresion"`.
- [ ] **Step 4:** Fusionar; esperar el despliegue de producción.
- [ ] **Step 5:** Verificar en fotoffice.com con sesión de Daniel: el botón aparece, el editor sube y recorta una foto de prueba; **sin cobrar** (cobrar lo hace Daniel con un pedido real chico). Revisar que el modo prueba de Impresiones (`testMode`) manda el correo al estudio.
