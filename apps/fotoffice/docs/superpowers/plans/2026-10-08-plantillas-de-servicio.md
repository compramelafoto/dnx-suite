# Plantillas de servicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** La propuesta modelo por categoría acepta conceptos calculados con ¿Cuánto Cobro?, que se cotizan con el perfil del workspace al enviarse sola o al crear un presupuesto desde una consulta (que ahora se precarga).

**Architecture:** Un concepto calculado de la propuesta guarda sólo el trabajo (`calculo.entrada.presupuesto`). Un módulo puro `instanciar-propuesta.ts` arma los ítems reales (LISTA desde el catálogo de hoy, CALCULO con el motor y el perfil vigente). Lo usan el envío automático y `crearPresupuesto`. El editor de la propuesta suma "Agregar concepto calculado".

**Tech Stack:** Next.js (leer `apps/fotoffice/node_modules/next/dist/docs/` antes de tocar rutas), React, Prisma, Vitest, `@repo/cuanto-cobro-core`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-plantillas-de-servicio-design.md`

## Global Constraints

- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/plantillas-servicio`, rama `feat/fotoffice-plantillas-servicio`. Nunca checkout/reset/rebase en otro árbol.
- Sin cambios de base de datos (ni schema ni SQL). Sin dependencias nuevas.
- La propuesta modelo NUNCA guarda el perfil: un ítem CALCULO de propuesta tiene `calculo` = `{ entrada: { presupuesto: <CuantoCobroQuoteInput parcial> } }` y nada más; `productId: null`; `precioUnitario: 0`.
- El perfil sólo llega al navegador con `configurar` (`veCostos`). El envío automático y el alta usan `leerPerfilPreciosDelSistema(workspaceId)` del lado del servidor.
- Crear un presupuesto nunca falla por la propuesta: ante cualquier problema, V1 vacía como hoy.
- Textos en español rioplatense (vos). Nombres en español como `lib/presupuestos`.
- Tests: `pnpm --filter fotoffice test -- <ruta>`; typecheck `pnpm --filter fotoffice typecheck` (leer salida; `NODE_OPTIONS=--max-old-space-size=8192` si hace falta).
- Commits terminan con línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Ítems calculados en la propuesta modelo + instanciar (puro)

**Files:**
- Modify: `apps/fotoffice/lib/presupuestos/propuestas-modelo.ts` (`validarItemsDeModelo`, mensajes, comentario de cabecera)
- Create: `apps/fotoffice/lib/presupuestos/instanciar-propuesta.ts`
- Test: `apps/fotoffice/lib/presupuestos/propuestas-modelo.test.ts` (ajustar el caso "sólo LISTA"), `apps/fotoffice/lib/presupuestos/instanciar-propuesta.test.ts`

**Interfaces (Produces):**
- `validarItemsDeModelo(raw)`: acepta LISTA con `productId` (como hoy, `calculo:null`) **y** CALCULO con `productId === null` y `calculo.entrada.presupuesto` objeto cuyo `concepts[0]` existe; devuelve el ítem CALCULO normalizado como `{ ...it, productId: null, precioUnitario: 0, calculo: { entrada: { presupuesto } } }` (descarta cualquier `perfil` u otro campo del cálculo). Rechaza: CALCULO sin trabajo → mensaje nuevo `MENSAJES_PROPUESTA_MODELO.conceptoInvalido = "Revisá el concepto calculado: le faltan las horas o el tipo de trabajo."`; LISTA sin producto → `soloLista` reescrito como "Los productos de la propuesta tienen que ser del catálogo.".
  - Ojo: `ItemPresupuesto.calculo` está tipado como `InstantaneaCalculo`; para la propuesta definir y exportar `type ConceptoDePropuesta = { entrada: { presupuesto: unknown } }` y castear con comentario, o ampliar el tipo localmente; no cambiar `InstantaneaCalculo`.
- `instanciarPropuesta(items: ItemPresupuesto[], deps: { productos: Map<string, { nombre: string; descripcion: string | null; precio: number }>; perfil: CuantoCobroProfileInput | null; nuevaClave: () => string; ahora?: Date }): { ok: true; items: ItemPresupuesto[] } | { ok: false; motivo: "PRODUCTO_INACTIVO" | "SIN_PERFIL" | "CALCULO" }`
  - LISTA: `{ ...it, id: nuevaClave(), nombre: p.nombre.slice(0, MAX_NOMBRE_ITEM), descripcion: p.descripcion?.slice(0, MAX_DESCRIPCION_ITEM) ?? null, precioUnitario: p.precio, modoPrecio: "LISTA", calculo: null }`; producto ausente → PRODUCTO_INACTIVO.
  - CALCULO: perfil null → SIN_PERFIL; `trabajoDesdeMotor(it.calculo.entrada.presupuesto)` null → CALCULO; si no, `calcularItemDelPanel(perfil, trabajo, tipoDeTrabajo, { id: nuevaClave(), nombre: it.nombre, seccion: it.seccion, opcional: it.opcional, descuento: it.descuento }, ahora)`; `!ok` → CALCULO.
  - Puro (sin `server-only`, sin prisma). Mover aquí la lógica de nombre/descr. de `itemsAlPrecioDeHoy` (Task 2 la reemplaza).
- Pruebas: LISTA al precio de hoy con id nuevo; producto inactivo; CALCULO con `createBaseCompleteProfile()` da el mismo precio que `calcularItemDelPanel` directo y `calculo.entrada.perfil` presente; SIN_PERFIL; trabajo roto → CALCULO; `validarItemsDeModelo` quita un `perfil` que venga dentro del cálculo.

- [ ] TDD (RED → GREEN), `pnpm --filter fotoffice test -- lib/presupuestos`, commit "Conceptos calculados en la propuesta modelo".

---

### Task 2: Perfil para el sistema + envío automático con conceptos calculados

**Files:**
- Modify: `apps/fotoffice/lib/precios/perfil.ts` (+ test), `apps/fotoffice/lib/presupuestos/propuesta-automatica.ts` (+ test `propuesta-automatica.test.ts`)

**Interfaces:**
- Produces `leerPerfilPreciosDelSistema(workspaceId: string): Promise<CuantoCobroProfileInput | null>` (sin permisos; comentario: "sólo servidor; nunca devolver al navegador sin veCostos").
- `itemsAlPrecioDeHoy` se reemplaza por: leer productos activos de los `productId` LISTA (mismo select que hoy) → Map; si hay algún CALCULO, leer el perfil del sistema; `instanciarPropuesta(...)`. `ok:false` → mismo camino de "FALLO" que hoy (loguear sólo el motivo).
- Pruebas nuevas: propuesta con un concepto calculado + perfil → ENVIADA, el ítem guardado es CALCULO con precio del motor, y lo que recibe la vista pública (usar el mapper real de `vista-publica.ts` o `itemSinDatosInternos`) no contiene `calculo` ni `entrada` ni `perfil`; sin perfil → FALLO y va la común. Los tests existentes LISTA siguen verdes.

- [ ] TDD, `pnpm --filter fotoffice test -- lib/presupuestos lib/precios`, commit "La propuesta automática cotiza conceptos calculados con el perfil".

---

### Task 3: Nuevo presupuesto desde una consulta, precargado

**Files:**
- Modify: `apps/fotoffice/lib/presupuestos/presupuestos.ts` (`crearPresupuesto`) (+ `presupuestos.test.ts`)

**Interfaces:**
- Consumes: `leerPropuestaModelo`, `instanciarPropuesta`, `leerPerfilPreciosDelSistema`, `normalizarBorrador` (como lo usa propuesta-automatica: `normalizarBorrador(workspaceId, { items, condiciones, propuestaPago }, new Map(), ahora)` — verificar firma).
- Comportamiento: con consulta (existente por `consultaLeadId` o recién creada con `nuevaConsulta.categoriaId`) cuya categoría tenga propuesta con ítems → ANTES de la transacción, instanciar + normalizar; si todo ok, V1 con `items`, `totals` y `costSnapshot` normalizados y `terms` = condiciones de la propuesta ?? ajustes. Cualquier falla (o excepción) → V1 vacía como hoy (log con código, sin datos personales). Sin categoría / sin propuesta → como hoy.
- Pruebas: precargado LISTA+CALCULO (totales coinciden); propuesta con producto inactivo → vacío y el alta OK; sin perfil y con CALCULO → vacío; sin propuesta → vacío; un usuario EQUIPO (sin configurar) que crea el presupuesto obtiene ítems CALCULO calculados (el perfil no viaja: lo verifica el editor existente).

- [ ] TDD, `pnpm --filter fotoffice test -- lib/presupuestos`, commit "Nuevo presupuesto precargado con la propuesta modelo de su categoría".

---

### Task 4: Editor de la propuesta modelo con conceptos calculados

**Files:**
- Modify: `apps/fotoffice/components/presupuestos/editor-propuesta-modelo.tsx`, `apps/fotoffice/app/workspace/configuracion/presupuestos/propuestas/[categoriaId]/page.tsx`, (si hace falta) `app/workspace/configuracion/presupuestos/actions.ts`
- Test: reglas de fuente en `apps/fotoffice/lib/presupuestos/pantallas.test.ts` o `app/workspace/configuracion/presupuestos/pagina.test.ts`

**Comportamiento:**
- La página lee `leerPerfilPrecios(ctx)` (ya exige `configurar`) y pasa `perfilDelWorkspace: CuantoCobroProfileInput | null`.
- El editor: botón "Agregar concepto calculado" (`fo-btn fo-btn-secondary`). Sin perfil: `AvisoSinPerfil` (exportado de `components/presupuestos/panel-cuanto-cobro.tsx`) en lugar del botón. Con perfil: abre un bloque con "Tipo de trabajo" (`CampoTexto`) + `CamposTrabajo` y la vista previa "Precio hoy: $X" (`calcularItemDelPanel`), botón "Agregar a la propuesta". El renglón agregado se muestra con su nombre, "Calculado con ¿Cuánto Cobro?" y el precio de hoy (sólo vista), con quitar y editar (reabre los campos con `trabajoDesdeMotor`).
- `guardar()` deja de forzar LISTA: LISTA como hoy; CALCULO se manda como `{ ...it, productId: null, precioUnitario: 0, modoPrecio: "CALCULO", calculo: { entrada: { presupuesto } } }` (sin perfil).
- Comentario de cabecera actualizado. Botones con variante (`fo-btn-…`), textos con role status/alert como el resto.
- Reglas de fuente: el editor no manda `perfil` en `guardarPropuestaModeloAction` (el objeto calculo sólo tiene `entrada.presupuesto`); la página pasa `perfilDelWorkspace` sólo dentro del bloque con permiso.

- [ ] Tests + typecheck sin errores, commit "Editor de la propuesta modelo con conceptos calculados".

---

### Task 5: Verificación

- [ ] Suite completa de FOTOFFICE verde, typecheck, `next build --webpack`.
- [ ] Revisión final de la rama; PR apilado sobre `feat/fotoffice-perfil-precios`.
