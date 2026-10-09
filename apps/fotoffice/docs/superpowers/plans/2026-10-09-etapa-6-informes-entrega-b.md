# Etapa 6 · Informes · Entrega B (Ventas y consultas) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dos pestañas nuevas en Informes: **Ventas** (pedidos agrupados × meses, con detalle) y **Embudo
de consultas** (por categoría u origen), con CSV.

**Architecture:** igual que la Entrega A (en producción desde el 09/10, PR 454): cálculo puro en
`lib/informes/{ventas,embudo}.ts`, lectura en `lib/informes/{ventas,embudo}-datos.ts`, pantallas de
servidor en `app/(shell)/informes/{ventas,embudo}`, CSV por la ruta existente
`app/api/informes/[informe]/csv/route.ts`. **Sin tablas nuevas ni SQL.**

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-09-etapa-6-informes-design.md` §2 "Entrega B".

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-6-informes-b` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas, sin cambios de schema ni migraciones.**
- **Reutilizar lo de la Entrega A:** `requireInformes`/`contextoDeInformes` (`lib/informes/acceso.ts`),
  `periodoInforme` y meses en hora de Buenos Aires (`lib/informes/periodos.ts`, `fechas.ts`), el patrón de
  topes y aviso ("Hay demasiados datos para este período, achicá el rango"), la tabla de matriz, el filtro
  de período, las pestañas (`components/informes/*`), `lib/informes/csv.ts`, `url.ts`, `menu.ts`.
- **Dinero en centavos enteros**, mostrado con `formatMinorArs`. Textos en español rioplatense; "dinero",
  nunca "plata".
- **Ventas — reglas:**
  - pedidos del workspace con `status != CANCELADO`, por **fecha de confirmación** (`createdAt` en día de
    Buenos Aires) **[decisión: es cuándo se vendió; Resultados ya muestra la vista por fecha del evento]**;
  - agrupar por (selector, por omisión **producto**): **producto**, **cliente**, **vendedor**
    (`ownerUserId`; nulo → "Sin vendedor"), **categoría** de la consulta y **origen** de la consulta
    (`consultaLeadId` → `FotofficeConsulta.categoryId`/`originId`; sin consulta → "Sin consulta");
  - por **producto**: una fila por `productId` de los ítems del JSON `items` (sin `productId` → por
    nombre, marcado "sin producto del catálogo"); importe del ítem con la **misma** fórmula por ítem que
    usa `lib/presupuestos/totales.ts` (cantidad × precio − descuento del ítem; ítems opcionales con la
    misma regla con la que el pedido los cuenta en su total); **no** se prorratea el descuento global, y la
    pantalla lo avisa; la columna de cantidad muestra **unidades** (suma de `cantidad`);
  - en los demás agrupamientos: importe = `totalArs` del pedido; cantidad = número de pedidos;
  - matriz grupo × meses con total por fila, por columna y general; máximo 24 meses;
  - cada celda abre `/informes/ventas/detalle`: número de pedido (enlace), fecha de confirmación,
    cliente, fecha del evento, categoría, vendedor, importe; total.
- **Embudo — reglas:**
  - consultas del workspace (`ServiceSalesLead` con su `FotofficeConsulta`) **creadas** en el período (día
    de Buenos Aires); agrupar por (selector, por omisión **categoría**) **categoría** u **origen**; fila
    "Sin categoría"/"Sin origen";
  - columnas: **entraron**, **ganadas**, **perdidas**, **abiertas**, **% de conversión** = ganadas ÷
    entraron (guion si entraron = 0), **valor estimado** (suma de `estimatedValue`), **vendido** (suma de
    `totalArs` de los pedidos no cancelados con `consultaLeadId` de esas consultas), **días promedio hasta
    cerrar** (sólo cerradas con fecha de cierre);
  - ganada/perdida y fecha de cierre: con la **misma fuente** que usa hoy Consultas para decidirlo (mirar
    `lib/circuitos/informe.ts`, `lib/circuitos/constantes.ts` `SALIDAS` y cómo la lista de Consultas
    muestra el estado); documentar en el código qué fuente se usó;
  - fila de totales; cada fila enlaza a la lista de Consultas filtrada si esa lista acepta el filtro por
    URL; si no, sin enlace (no inventar filtros nuevos en Consultas).
- **Acceso:** el mismo que el resto de Informes (`requireInformes`). Todas las consultas filtran por
  `workspaceId`.
- **Menú y tablero:** subítems "Ventas" y "Embudo" en la sección Informes; palabras del ⌘K; tarjetas del
  Tablero no cambian **[decisión]**.
- **Verificación:** vitest completo; tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`
  (código de salida y salida); `next build --webpack` y después `rm -rf apps/fotoffice/.next`; sin
  tsbuildinfo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Ventas
**Files:** `lib/informes/{ventas,ventas-datos}.ts` y sus pruebas; `app/(shell)/informes/ventas/{page,detalle/page}.tsx`;
CSV de ventas (matriz y detalle) en la ruta existente; pestaña, menú y ⌘K.
- [ ] Cálculo puro: agrupar por los cinco criterios, importes de ítem idénticos a `totales.ts`, meses en
  hora argentina, cruce de año, "Sin vendedor"/"Sin consulta", aviso de descuento global no prorrateado.
- [ ] Lectura con aislamiento, topes y aviso; cancelados fuera.
- [ ] Pantalla con selector de agrupamiento y período, matriz, detalle por celda, CSV, estado vacío.
- [ ] Pruebas: puras, de lectura (aislamiento, cancelados, tope) y del CSV.
- [ ] Commit `Informes: ventas por producto, cliente, vendedor, categoría y origen`.

### Task 2: Embudo de consultas
**Files:** `lib/informes/{embudo,embudo-datos}.ts` y sus pruebas; `app/(shell)/informes/embudo/page.tsx`;
CSV del embudo; pestaña, menú y ⌘K.
- [ ] Cálculo puro: entraron/ganadas/perdidas/abiertas, conversión, valor estimado, vendido, días
  promedio; totales; división por cero.
- [ ] Lectura con la misma fuente de ganada/perdida que Consultas, aislamiento, topes.
- [ ] Pantalla con selector categoría/origen y período, tabla, enlaces sólo si Consultas acepta el
  filtro, CSV, estado vacío.
- [ ] Pruebas: puras, de lectura y del CSV.
- [ ] Commit `Informes: embudo de consultas por categoría y origen`.
