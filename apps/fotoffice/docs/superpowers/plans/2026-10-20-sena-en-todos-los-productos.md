# Seña en todos los productos del Cobrador — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier producto del Cobrador pueda dejar seña y pasar a un pedido para retirar con su trabajo y stock apartado, y que ningún trabajo de un pedido con saldo se pueda entregar.

**Architecture:** Se reusa el camino que ya existe para los productos con proceso (`cobrarConPedidoAction` → `crearPedidoManual` → `crearProyectosDelPedido`). Se le suma una marca por línea («para retirar»), un flujo estándar con marca estable (`systemKey`), el apartado de stock dentro de la transacción del pedido y un candado de saldo en el motor de recorridos (`lib/circuitos/recorridos.ts`), que es la única puerta por la que cambia una etapa.

**Tech Stack:** Next.js (versión del repo: leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma + Postgres (Neon), Vitest con la base en memoria `lib/circuitos/base-en-memoria.ts`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-sena-en-todos-los-productos-design.md`

Trabajar en el worktree `.claude/worktrees/sena-todos` (rama `feat/fotoffice-sena-todos-los-productos`). Rutas relativas a `apps/fotoffice` salvo que digan `packages/db`.

## Global Constraints

- El candado no tiene excepciones: ni `forzar`, ni `deSistema`, ni rol `configurar` lo saltean.
- Mensaje del candado, exacto: `El pedido {numero} debe {saldo}. Cobrá el saldo antes de entregar.` (`saldo` con `formatMinorArs`, sin `,00`).
- Saldo = `totalArs` − suma de `FotofficeCobro.amountArs` con `voidedAt: null`; pedido `CANCELADO` = saldo 0. Misma cuenta que `lib/proyectos/en-curso.ts:83-106`.
- Flujo estándar: nombre «Para retirar», clase `TRABAJO`, `systemKey = "PARA_RETIRAR"`, etapas en orden: «Recibido» (gris, 0 días), «En preparación» (azul, 1), «Listo para retirar» (amarillo, 0), «Entregado» (verde, 0). Si el nombre está tomado y no sirve, «Para retirar (FOTOFFICE)».
- Plazo sugerido de un producto sin regla: 1 día.
- Stock: sólo las líneas marcadas «para retirar» cuyo producto NO tiene regla y tiene `tracksStock`. Motivo `PEDIDO`, `sourceModule = "pedidos"`, `sourceRef = pedidoId`; la devolución usa `DEVOLUCION` con el mismo `sourceRef`. Todo por `applyStockMovement` (`lib/sales/variant-stock.ts`).
- Migraciones: SQL idempotente (`IF NOT EXISTS`), carpeta con fecha posterior a `20261128120000`. Se aplica a mano y se registra con `prisma migrate resolve` (sin staging: va directo a producción).
- Importes del Mostrador en centavos; los del pedido en pesos.
- Textos de pantalla en español rioplatense, como el resto de la app.

## Review Focus

1. Pedido con saldo y trabajo en «Listo para retirar» → el botón «Entregado» del tablero, el cambio de etapa desde la ficha y el cierre «Terminado» fallan los tres con el mensaje del candado (Task 2).
2. Doble clic en «Cobrar seña» → un solo pedido, un solo cobro y un solo movimiento de stock (Task 5).
3. El estudio ya tiene un flujo llamado «Para retirar» archivado → la seña no falla y se crea «Para retirar (FOTOFFICE)» (Task 3).
4. Se cancela un pedido con un trabajo ya entregado y otro sin entregar → vuelve sólo el stock del que no se entregó (Task 6).
5. Ticket con una línea con proceso y otra marcada «para retirar» del mismo producto sin regla → dos trabajos, uno por línea, y el stock baja sólo por la marcada (Task 4 y Task 5).

---

### Task 1: Esquema — marca del flujo, clave de alta del pedido y motivo de stock

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`model FotofficeCircuit` ~20615, `model FotofficePedido` ~21390)
- Create: `packages/db/prisma/migrations/20261129120000_fotoffice_sena_para_retirar/migration.sql`
- Modify: `lib/sales/constants.ts:20` y la etiqueta de motivos donde se muestren (buscar `DEVOLUCION` en `app/` y `components/`)
- Test: `lib/sales/constants.test.ts` (crear si no existe)

**Interfaces:**
- Produces: `FotofficeCircuit.systemKey: String?`; `FotofficePedido.altaKey: String?`; `StockReason` incluye `"PEDIDO"`; `ETIQUETA_MOTIVO_STOCK.PEDIDO = "Apartado para pedido"` (usar el mapa de etiquetas que ya exista; si no hay, crear `STOCK_REASON_LABELS` en `constants.ts`).

- [ ] **Step 1:** Test: `STOCK_REASONS` contiene `"PEDIDO"` y su etiqueta es «Apartado para pedido». Correr `npx vitest run lib/sales/constants.test.ts` → FAIL.
- [ ] **Step 2:** Agregar al schema `systemKey String?` en `FotofficeCircuit` y `altaKey String?` en `FotofficePedido`, cada uno con su comentario `///` en el estilo del archivo. Migración: dos `ADD COLUMN IF NOT EXISTS` y dos índices únicos parciales `CREATE UNIQUE INDEX IF NOT EXISTS ... ("workspaceId", "systemKey") WHERE "systemKey" IS NOT NULL` (ídem `altaKey`). Documentar el único parcial en el `///` como hace `FotofficeMessageTemplate` (~20918).
- [ ] **Step 3:** Agregar `"PEDIDO"` a `STOCK_REASONS` y su etiqueta. Revisar cada pantalla o informe que filtra o etiqueta motivos para que lo reconozca.
- [ ] **Step 4:** `npx prisma generate` (desde `packages/db`), `npx vitest run lib/sales/constants.test.ts` → PASS, `npm run typecheck` → sin errores nuevos. Ojo: el typecheck puede morir por memoria y devolver éxito; mirar que haya terminado de verdad.
- [ ] **Step 5:** Commit «Sumar la marca del flujo Para retirar, la clave de alta del pedido y el motivo PEDIDO».

### Task 2: Candado del saldo en el motor de recorridos

**Files:**
- Create: `lib/pedidos/candado-saldo.ts` (servidor) y `lib/pedidos/candado-saldo-puro.ts` (puro)
- Modify: `lib/circuitos/recorridos.ts` (`moverEnTransaccion` ~295, `cerrarEnTransaccion` ~392, `cambiarDeCircuito` ~532)
- Test: `lib/pedidos/candado-saldo-puro.test.ts`, `lib/circuitos/recorridos.test.ts` (nuevo `describe("candado del saldo")`)

**Interfaces:**
- Produces (puro): `saldoPedidoMinor(p: { totalArs: number; cobradoArs: number; status: string }): number` y `mensajeCandado(numero: string, saldoMinor: number): string`.
- Produces (servidor): `exigirPedidoPagado(tx: Tx, workspaceId: string, journey: { subjectType: string; subjectId: string }): Promise<void>`. Lanza `Rechazo(mensajeCandado(...))` si el sujeto es `PROYECTO`, tiene `pedidoId` y el saldo es > 0. No hace nada en otro caso.
- Consumes: `faseDeEtapa` de `lib/proyectos/en-curso-puro.ts`; `Rechazo` de `recorridos.ts` (exportarlo si hace falta, o que `exigirPedidoPagado` devuelva el mensaje y `recorridos.ts` lance).

- [ ] **Step 1: Tests puros:** `saldoPedidoMinor({ totalArs: 10000, cobradoArs: 5000, status: "CONFIRMADO" }) === 500000`; con `status: "CANCELADO"` → `0`; con cobrado > total → `0`. `mensajeCandado("P-12", 500000) === "El pedido P-12 debe $ 5.000. Cobrá el saldo antes de entregar."` (ajustar el formato exacto a lo que devuelve `formatMinorArs` sin `,00`).
- [ ] **Step 2: Tests del motor** (base en memoria, con un proyecto atado a un pedido de total $10.000 y cobro de $5.000, flujo Recibido → Listo para retirar → Entregado):
  - `mover` a «Entregado» → `{ ok: false, error: <mensaje del candado> }`, el recorrido sigue en «Listo para retirar».
  - `mover` a «Entregado» con `forzar: true` y rol de administrador → mismo rechazo.
  - `cerrar(..., "TERMINADO")` → mismo rechazo; `cerrar(..., "CANCELADO", motivo)` → ok.
  - Tras un cobro de $5.000 más, `mover` a «Entregado» → ok.
  - `cambiarDeCircuito` a un flujo de una sola etapa → rechazo.
  - Proyecto sin pedido → `mover` a «Entregado» ok. Pedido cancelado con deuda → ok.
  - Mover de «Recibido» a «Listo para retirar» con deuda → ok (el candado sólo frena la fase ENTREGADO).
- [ ] **Step 3:** Correr `npx vitest run lib/pedidos/candado-saldo-puro.test.ts lib/circuitos/recorridos.test.ts` → FAIL.
- [ ] **Step 4: Implementar.** En `moverEnTransaccion`, leer también `name` y `color` de las etapas. Si `faseDeEtapa({ ...destino, esUltima: destino.order === maxOrdenNoArchivada })` es `"ENTREGADO"`, llamar a `exigirPedidoPagado` **antes** de `validarMovimiento`, sin mirar `forzar`. En `cerrarEnTransaccion`, si `salida === salidas.exito`, llamar siempre. En `cambiarDeCircuito`, aplicar lo mismo a `primera`. `exigirPedidoPagado` bloquea el pedido con `bloquearPedido` (`lib/pedidos/plan.ts`) para que un cobro anulado en paralelo no se cuele.
- [ ] **Step 5:** Tests → PASS. Correr también `npx vitest run lib/circuitos lib/proyectos lib/service-leads` para ver que nada viejo se rompió. Si algún test existente entregaba con deuda, corregir los datos de prueba (no el candado).
- [ ] **Step 6:** Commit «Candado: un trabajo de un pedido con saldo no se entrega».

### Task 3: Flujo estándar «Para retirar»

**Files:**
- Create: `lib/circuitos/semillas/para-retirar.ts`
- Test: `lib/circuitos/semillas/para-retirar.test.ts`

**Interfaces:**
- Produces: `FLUJO_PARA_RETIRAR: SemillaCircuito` (con las etapas de Global Constraints) y `asegurarFlujoParaRetirar(tx: Tx, workspaceId: string): Promise<{ circuitId: string; etapas: EtapaDelFlujo[] }>`.
- Consumes: `datosCircuito` de `semillas/asegurar.ts` (exportarlo); `EtapaDelFlujo` de `lib/proyectos/crear.ts`.

- [ ] **Step 1: Tests:**
  - Sin flujos → crea uno con `systemKey = "PARA_RETIRAR"`, 4 etapas, y `faseDeEtapa` de cada una da RECIBIDO, EN_PROCESO, LISTO, ENTREGADO.
  - Dos llamadas → el mismo `circuitId` (no duplica).
  - Ya existe «Para retirar» del estudio, TRABAJO, activo, con etapas y sin marca → lo marca y lo usa.
  - Ya existe «Para retirar» archivado o de clase VENTA → crea «Para retirar (FOTOFFICE)».
  - El marcado está archivado o sin etapas → lo reactiva y le repone las 4 etapas por defecto si no tiene ninguna activa.
- [ ] **Step 2:** `npx vitest run lib/circuitos/semillas/para-retirar.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Buscar por `systemKey`; después por nombre; recién después crear. Corre dentro de la transacción del pedido, así que no puede depender de capturar un P2002 (en Postgres aborta la transacción): primero mirar, después insertar.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit «Flujo estándar Para retirar, creado la primera vez que hace falta».

### Task 4: Trabajos de las líneas «para retirar»

**Files:**
- Modify: `lib/proyectos/crear.ts` (`DatosCrearDelPedido`, `crearProyectosDelPedido` ~290)
- Test: `lib/proyectos/crear.test.ts`

**Interfaces:**
- Consumes: `asegurarFlujoParaRetirar` (Task 3).
- Produces: `DatosCrearDelPedido.paraRetirar?: ReadonlySet<number>`, con las posiciones de los ítems del pedido marcados. `ResultadoCrearDelPedido` no cambia.

- [ ] **Step 1: Tests:**
  - Ítem 0 con producto sin regla, `paraRetirar = {0}` → 1 proyecto en el flujo estándar, `pedidoItemIndex = 0`, `productId` del ítem, nombre `«Producto» · Cliente` (plantilla por defecto de `aplicarPlantillaNombre`).
  - Ítem a mano (`productId: null`) marcado → 1 proyecto con `productId: null` y el nombre del ítem.
  - Producto con regla y marcado → sólo el proyecto de la regla (no el estándar).
  - Combo sin regla, con un componente con regla, marcado → sólo el del componente.
  - Sin `paraRetirar` → mismo resultado que hoy (los tests existentes no cambian).
  - Llamado dos veces con el mismo pedido → no duplica.
- [ ] **Step 2:** `npx vitest run lib/proyectos/crear.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Después del bucle de reglas, para cada índice de `paraRetirar` que no generó ningún planificado, se llama `asegurarFlujoParaRetirar` una sola vez (perezoso), se mira el único (pedido, ítem, flujo) y se llama `insertarProyecto`. `baseDate` = `fechaBase(d.fechaEvento, d.confirmadoEn)` y `finalDueDate` = `baseDate`. No tocar `planificarProyectos`: la vista previa de presupuestos queda igual.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit «Los productos con seña sin proceso propio generan su trabajo Para retirar».

### Task 5: Alta del pedido idempotente y stock apartado

**Files:**
- Modify: `lib/pedidos/pedidos.ts` (`DatosPedidoManual` ~179, `crearPedidoManual` ~232, `insertarPedido` ~134)
- Test: `lib/pedidos/pedidos.test.ts` (o el archivo de pruebas del alta manual que ya exista; buscar `crearPedidoManual` en `*.test.ts`)

**Interfaces:**
- Consumes: `applyStockMovement`, `StockReason "PEDIDO"` (Task 1); `paraRetirar` de `crearProyectosDelPedido` (Task 4).
- Produces: `DatosPedidoManual` suma `clave?: unknown` (mismo formato que `CLAVE` de `pedido-actions.ts`), `paraRetirar?: unknown` (ids de ítem, `string[]`) y `apartar?: unknown` (`{ itemId: string; productId: string; variantId: string | null; cantidad: number }[]`). `ResultadoAlta` ok suma `repetido: boolean`.

- [ ] **Step 1: Tests:**
  - Con `clave` → `altaKey` guardada. Segunda llamada con la misma clave → `{ ok: true, repetido: true }` con el mismo `pedidoId`; un solo pedido, un solo movimiento de stock y un solo proyecto.
  - `apartar` de 2 unidades de un producto con `tracksStock` → un `StockMovement` `qty: -2`, `reason: "PEDIDO"`, `sourceModule: "pedidos"`, `sourceRef: pedidoId`, con `variantId`. Producto sin `tracksStock` → ningún movimiento.
  - `apartar` con un `productId` que no está en los ítems → `{ ok: false }` y nada escrito.
  - `paraRetirar` con un id de ítem que no existe → `{ ok: false }`.
- [ ] **Step 2:** Correr el test → FAIL.
- [ ] **Step 3:** Implementar. Antes de la transacción, si hay `clave`, buscar el pedido por (`workspaceId`, `altaKey`) y devolverlo con `repetido: true`. Dentro de la transacción, insertar con `altaKey`, traducir `paraRetirar` a posiciones de `items` para `crearProyectosDelPedido` y aplicar `apartar` con `applyStockMovement` sólo si `product.tracksStock`. Si dos pedidos chocan en el único (P2002 al salir de la transacción), releer por clave y devolver `repetido: true`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit «Alta de pedido sin duplicados y stock apartado por la seña».

### Task 6: Cancelar devuelve lo apartado y no entregado

**Files:**
- Modify: `lib/pedidos/pedidos.ts` (`cambiarEstadoPedido` ~341)
- Test: el mismo archivo de pruebas de la Task 5

**Interfaces:**
- Consumes: los movimientos `PEDIDO` de la Task 5 (`sourceRef = pedidoId`), `faseDeEtapa`.
- Produces: ningún tipo nuevo.

- [ ] **Step 1: Tests:**
  - Pedido con 2 líneas apartadas, ninguna entregada; se cancela → dos movimientos `DEVOLUCION` que suman lo apartado.
  - Una línea con su trabajo cerrado `TERMINADO` o en fase ENTREGADO → sólo vuelve la otra.
  - Cancelar dos veces (la segunda falla por transición) → no hay devolución doble.
  - Pedido sin apartados → cancelar igual que hoy.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar dentro de la misma transacción de `cambiarEstadoPedido`, después del `updateMany` exitoso a `CANCELADO`. Para saber qué línea es de qué trabajo, usar `FotofficeProyecto.pedidoItemIndex` contra la posición del ítem; guardar `itemId` en `note` del movimiento `PEDIDO` (o equivalente) para poder emparejar. No devolver si ya existe un `DEVOLUCION` con ese `sourceRef` y la misma línea.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit «Cancelar un pedido devuelve el stock apartado que no se entregó».

### Task 7: Cobrador — marcar cualquier línea «Deja seña»

**Files:**
- Modify: `app/(shell)/ventas/pedido-actions.ts`, `app/(shell)/ventas/pos.tsx` (`calcularPedido` ~579, renglón ~1102, envío ~642-680)
- Test: `lib/sales/pedido-mostrador.test.ts` (lógica pura de separación)
- Modify: `lib/sales/pedido-mostrador.ts`

**Interfaces:**
- Consumes: `crearPedidoManual` con `clave`, `paraRetirar`, `apartar` (Task 5).
- Produces: `LineaMostrador.paraRetirar?: boolean`; puro `separarTicket<L extends { productId: string | null; paraRetirar?: boolean }>(lineas: L[], conProceso: ReadonlySet<string>): { delPedido: L[]; enElMomento: L[] }`; `PLAZO_SIN_REGLA_DIAS = 1`.

- [ ] **Step 1: Tests puros de `separarTicket`:** una línea con proceso va al pedido; una sin proceso marcada va al pedido; una sin proceso sin marcar va a la venta; una a mano marcada va al pedido; una con proceso con `paraRetirar: false` igual va al pedido.
- [ ] **Step 2:** `npx vitest run lib/sales/pedido-mostrador.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `separarTicket` y usarlo en `cobrarConPedidoAction` en lugar de las dos líneas `delPedido`/`enElMomento`. El mensaje «Nada de este ticket lleva proceso…» pasa a «Nada de este ticket queda para retirar: cobralo como venta común.». Pasar a `crearPedidoManual`: `clave: input.clave`, ids de ítem (`m1`…) de las líneas marcadas sin regla en `paraRetirar`, y `apartar` con esas mismas líneas que tengan `productId` (y `variantId`). `ultimoPlazoDias` sólo se actualiza para los productos con regla, como hoy. Si `alta.repetido`, no volver a registrar el cobro ni la venta: devolver el resultado del pedido existente.
- [ ] **Step 4:** En `pos.tsx`: estado `paraRetirar: Record<string, boolean>` por `r.key`. En cada renglón sin proceso, un interruptor chico «Seña» (con `aria-pressed`) junto a donde hoy aparece la etiqueta «Pedido». Si está prendido, el renglón muestra «Pedido» y entra en `calcularPedido`. `calcularPedido` usa `separarTicket`, y para el plazo usa `PLAZO_SIN_REGLA_DIAS` en las líneas sin regla. `lines` envía `paraRetirar`. Al vaciar el ticket, se limpia el estado.
- [ ] **Step 5:** Tests → PASS. `npm run typecheck`. Probar en el navegador con `next dev --webpack` (ver `.claude/launch.json`): marcar «Seña» en un producto sin proceso, ver el recuadro «Pedido para retirar · 1 trabajo» con la entrega a 1 día y cobrar la seña. Revisar en Proyectos → «En curso» que esté la tarjeta en «Recibido».
- [ ] **Step 6:** Commit «Cobrador: cualquier producto puede dejar seña y quedar para retirar».

### Task 8: Pantallas del candado y guías

**Files:**
- Modify: `components/proyectos/en-curso/tablero-en-curso.tsx` (~377-395, ~420)
- Modify: `app/(shell)/ventas/pos.tsx` (pedidos en curso del cliente ~1223)
- Modify: `lib/instructivos/guias/trabajos-tomar-con-sena.ts`, `lib/instructivos/guias/trabajos-retiro-y-saldo.ts`
- Test: el que ya cubra la tarjeta del tablero (`lib/circuitos/tablero-vista.test.ts` o `lib/proyectos/en-curso-puro.test.ts`), con un puro nuevo si hace falta.

**Interfaces:**
- Consumes: `mensajeCandado` (Task 2).
- Produces: puro `retenido(t: { fase: Fase; pedido: { saldoMinor: number } | null }): boolean` en `en-curso-puro.ts` (true si `fase === "LISTO"` y hay saldo).

- [ ] **Step 1:** Test de `retenido`: LISTO con saldo → true; LISTO sin saldo → false; EN_PROCESO con saldo → false; sin pedido → false. Correr → FAIL; implementar → PASS.
- [ ] **Step 2:** En la tarjeta: si `retenido`, la insignia dice «Retenido · debe $X» y el botón «Entregado» queda deshabilitado con `title` = `mensajeCandado(...)`. Si el servidor rechaza igual (cambió algo en el medio), mostrar su mensaje como hoy.
- [ ] **Step 3:** En el Cobrador, cada pedido en curso del cliente con saldo y algún trabajo LISTO muestra «Debe $X · retenido hasta pagar».
- [ ] **Step 4:** Guías: `trabajos-tomar-con-sena.ts` deja de decir que sólo los productos con proceso llevan seña; explica el interruptor «Seña» y el flujo «Para retirar». `trabajos-retiro-y-saldo.ts` dice que sin cobrar el saldo no se puede marcar «Entregado», y saca la nota de llevárselo sin pagar. Las imágenes que muestran pantallas viejas se marcan para rehacer en el PR (no se inventan).
- [ ] **Step 5:** `npm test` completo y `npm run typecheck`. Prueba de punta a punta en el navegador: seña → «Listo para retirar» → «Entregado» bloqueado con el mensaje → cobrar saldo en el Cobrador → «Entregado» funciona.
- [ ] **Step 6:** Commit «Mostrar el pedido retenido y actualizar las guías de seña y retiro».

### Cierre

- [ ] Aplicar la migración en la base de producción de FOTOFFICE (rama «development» de su proyecto Neon) y registrarla con `prisma migrate resolve --applied 20261129120000_fotoffice_sena_para_retirar`.
- [ ] PR contra `main`, con la nota de que los pedidos con deuda que hoy están en «Listo para retirar» quedan retenidos desde el deploy.
