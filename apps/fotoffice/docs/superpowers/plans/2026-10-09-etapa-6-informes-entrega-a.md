# Etapa 6 · Informes · Entrega A (Dinero) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** módulo "Informes" con Tablero, Resultados (dos vistas), Flujo de caja proyectado, Monotributo y
Ajustes, todo con CSV y desglose.

**Architecture:**
- **Cálculo puro separado de la lectura:** cada informe tiene un archivo puro en `lib/informes/` (recibe
  filas ya leídas, devuelve la matriz en centavos enteros) y un cargador `*-datos.ts` que lee con Prisma,
  aplica topes y llama al puro. Las pantallas son componentes de servidor; los filtros son formularios GET.
- **Reutiliza:** `lib/listado/periodos.ts` (hora de Buenos Aires), `lib/cash/balance.ts`
  (`balancesByAccountMinor`), `lib/cash/category-report.ts` (`groupCategoryReportRows`),
  `lib/rubros/rubros.ts` (`compararCodigos`), `lib/pedidos/plan.ts` + `lib/pedidos/estado.ts`
  (`planesDe`, `resumenDePlan` para el saldo de cuotas), `lib/listado/csv.ts` (`armarCsvExcel`),
  `lib/membership/money.ts` (`decimalArsToMinor`, `formatMinorArs`), `lib/access/policy.ts` (`puede`).
- **Datos:** una tabla nueva `FotofficeInformesAjustes`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-09-etapa-6-informes-design.md` (rama de docs
`docs/fotoffice-crm-alboom`).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-6-informes` desde `origin/main`, en el worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas.** El lockfile no cambia.
- **Base de datos:**
  - una migración: `packages/db/prisma/migrations/20261028120000_fotoffice_etapa_6_informes/migration.sql`;
  - sólo la tabla nueva `FotofficeInformesAjustes`: `id` TEXT PK, `workspaceId` TEXT único (FK Workspace
    ON DELETE CASCADE ON UPDATE CASCADE), `minBalanceArs` DECIMAL(14,2) NULL, `monotributoCategory` TEXT
    NULL, `monotributoCapArs` DECIMAL(14,2) NULL, `monotributoWarnPct` INTEGER NOT NULL DEFAULT 80,
    `updatedAt` TIMESTAMP(3) NOT NULL;
  - CHECKs: `monotributoWarnPct BETWEEN 50 AND 99`; `minBalanceArs IS NULL OR minBalanceArs >= 0`;
    `monotributoCapArs IS NULL OR monotributoCapArs > 0`; `monotributoCategory IS NULL OR
    length(monotributoCategory) <= 20`;
  - relación inversa en `Workspace` (`fotofficeInformesAjustes FotofficeInformesAjustes?`); nada más cambia
    en tablas existentes;
  - sin líneas que no sean SQL (prueba de fuente como `lib/proyectos/migracion-proyectos.test.ts`);
  - no se aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-6-INFORMES.md`.
- **Módulo:** `reports` ("Informes") en `MODULE_REGISTRY`: `AVAILABLE`, `route: "/informes"`, sin
  `dependsOn`, familia de gestión (la misma que `cash`/`orders`; mirar `lib/modules/suggested.ts` y
  `nav-order.ts` y sus pruebas). Constante `REPORTS_MODULE_KEY = "reports"` en `lib/informes/constantes.ts`.
- **Acceso:** toda pantalla, CSV y acción exige sesión, workspace, módulo `reports` encendido
  (`isModuleEnabledForWorkspace`) y `puede(acceso, "verDinero", "reports")` (mirar la firma real de `puede` y
  cómo `verDinero` resuelve dueño/admin/Caja). Ajustes exige además `configurar`. Sin permiso: `notFound()`
  o redirección como hacen los otros módulos (`lib/pedidos/pagina.ts` es el modelo).
- **Dinero:** todo se suma en centavos enteros (`number` seguro o `bigint`), nunca en coma flotante; se
  muestra con `formatMinorArs`. Textos: "dinero", nunca "plata".
- **Fechas:** límites de día, semana (lunes a domingo) y mes en hora de Buenos Aires
  (`lib/listado/periodos.ts`: `hoyEnBuenosAires`, `resolverPeriodo`). Columnas `@db.Date` se comparan como
  fecha calendario.
- **Topes:** máximo 24 meses por consulta en Resultados; tope de filas por lectura (50 000 movimientos,
  20 000 cuotas/cuentas). Si se supera: aviso "Hay demasiados datos para este período, achicá el rango" y
  sin datos parciales.
- **Reglas de cálculo (de la spec, obligatorias):**
  - **Bloque de un rubro por código** (`codigo` de `FotofficeRubro`, o el del padre si el hijo no tiene):
    empieza con `3` → Ingresos; `4` → Costos; `5` → Gastos; otro, sin código o movimiento sin rubro →
    "Sin clasificar" (separado en ingreso y egreso según `kind`).
  - **Vista "Lo cobrado y pagado"** (`base=caja`, por omisión): `CashMovement` del workspace por
    `occurredAt`, sin transferencias (`transferId != null` se excluye). Un movimiento con
    `reversesMovementId` **resta en el bloque y rubro del movimiento original** (se busca el original;
    si no está en el lote, se lee). INGRESO suma en su bloque; EGRESO suma en su bloque (costos y gastos se
    muestran en positivo).
  - **Vista "Lo vendido y comprometido"** (`base=devengado`): pedidos con `status != CANCELADO` por
    `eventDate` (si es nula, `createdAt` en día de Buenos Aires), importe `totalArs`, rubro
    `incomeCategoryId`; todas las `FotofficeCuentaPagar` por `dueDate` (si es nula, `createdAt`), importe
    `amountArs`, rubro `costCategoryId` (`voidedAt` es un pago anulado: la cuenta sigue contando); más los
    `CashMovement` con `sourceModule` distinto de `MODULO_CAJA_PEDIDOS` ("pedidos") y `MODULO_CAJA_PAGOS`
    ("pedidos-pagos"), con la misma regla de transferencias y anulaciones que la otra vista.
  - **Resultado** = Ingresos − Costos − Gastos + Sin clasificar ingreso − Sin clasificar egreso.
  - **Por cobrar:** saldo de cada cuota (`resumenDePlan`) de pedidos `CONFIRMADO`, `EN_CURSO` o
    `COMPLETADO`, por `dueDate`. **Por pagar:** `FotofficeCuentaPagar` con `paidAt = null`, por `dueDate`;
    las de `dueDate` nula van en "Sin fecha" y no suman al acumulado.
  - **Saldo de Caja hoy:** `balancesByAccountMinor` sobre las cuentas activas.
  - **Monotributo:** ingresos de Caja de los últimos 12 meses móviles (el mes en curso y los 11 anteriores,
    en hora de Buenos Aires), sin transferencias, neto de anulaciones (regla de arriba); se compara con
    `monotributoCapArs`; semáforo verde < `monotributoWarnPct` %, amarillo ≥, rojo ≥ 100 %. Leyenda fija:
    "Control interno con lo registrado en Caja. No reemplaza la facturación informada a ARCA."
- **CSV:** ruta propia `app/api/informes/[informe]/csv/route.ts` con el mismo permiso que la pantalla,
  `armarCsvExcel`, nombre de archivo con `nombreArchivoExport`; columnas de importes en pesos.
- **Verificación:** vitest completo; tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192` mirando
  código de salida y salida; como cambia el schema: `prisma validate` y `prisma generate`, y tsc de las apps
  que comparten schema; `next build --webpack` de fotoffice y después `rm -rf apps/fotoffice/.next`; sin
  tsbuildinfo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tabla, módulo y cálculos puros
**Files:**
- `packages/db/prisma/schema.prisma`, la migración y `lib/informes/migracion-informes.test.ts`;
- `lib/informes/{constantes,bloques,resultados,flujo,monotributo,periodos}.ts` y sus pruebas;
- `lib/modules/registry.ts` (+ pruebas de registro/familias que lo exijan).

**Interfaces (Produces):**
- `bloqueDeCodigo(codigo: string | null): "INGRESOS" | "COSTOS" | "GASTOS" | null`.
- `armarResultados(entrada: { meses: string[] /* "AAAA-MM" */; rubros: RubroInfo[]; asientos: Asiento[] }): MatrizResultados`
  donde `Asiento = { mes: string; categoryId: string | null; kind: "INGRESO" | "EGRESO"; centavos: number; signo: 1 | -1 }`
  y `MatrizResultados` tiene bloques con filas por rubro (agrupadas por padre con subtotal), total por mes y
  total general, y la fila `resultado`.
- `asientosDeCaja(movs, originales)` y `asientosDevengados({ pedidos, cuentas, movs, originales })` →
  `Asiento[]` (aplican transferencias, anulaciones y exclusión por `sourceModule`).
- `armarFlujo({ hoy, agrupar: "dia" | "semana" | "mes", hasta, saldoCaja, cuotas, cuentas, saldoMinimo })`
  → filas `{ etiqueta, desde, hasta, porCobrar, porPagar, neto, acumulado, bajoMinimo }`, fila inicial
  "Hoy" con `saldoCaja`, `vencidoCobrar`, `vencidoPagar`, y fila `sinFecha`.
- `armarMonotributo({ hoy, ingresosPorMes, tope, avisoPct })` → `{ meses, total, porcentaje, estado: "SIN_CONFIGURAR" | "VERDE" | "AMARILLO" | "ROJO", falta }`.
- `periodoInforme(params)` → rango de meses validado (atajos: este-mes, mes-pasado, ultimos-3, ultimos-6,
  este-anio, anio-pasado, rango `AAAA-MM..AAAA-MM`; máximo 24; si es inválido, por omisión con aviso).

- [ ] Modelo, SQL y prueba de fuente según las Global Constraints.
- [ ] Módulo `reports` en el registro.
- [ ] Cálculos puros con pruebas: bloques por código (incluye hijo sin código que hereda el padre),
  transferencias excluidas, anulación que resta en el rubro del original aunque sea de otro mes, base
  devengada sin doble conteo de cobros de pedidos, centavos exactos, semanas lunes-domingo en hora
  argentina, cruce de año, saldo mínimo, "Sin fecha", semáforo en los bordes (79,99 % / 80 % / 100 %).
- [ ] Commit `Informes: tabla, módulo y cálculos (SQL sin aplicar)`.

### Task 2: Lectura de datos, acceso y ajustes
**Files:** `lib/informes/{acceso,ajustes,resultados-datos,flujo-datos,monotributo-datos,tablero-datos}.ts`
y sus pruebas (con `lib/circuitos/base-en-memoria.ts` o mocks de Prisma como hacen las pruebas de
`lib/pedidos/informes-datos.test.ts`); `app/actions/informes.ts` (guardar ajustes).

- [ ] `acceso.ts`: `requireInformes()` / `requireInformesConfigurar()` según Global Constraints.
- [ ] Cargadores con aislamiento por `workspaceId` en **todas** las consultas, topes y aviso de exceso.
- [ ] `tablero-datos.ts`: por cobrar vencido / 7 / 30 días, por pagar ídem, saldos por cuenta, resultado
  del mes y del anterior (base caja), monotributo, primera fecha bajo el saldo mínimo (horizonte 3 meses).
- [ ] Ajustes: leer con valores por omisión si no hay fila; guardar con validación (importes ≥ 0, tope
  > 0, aviso 50–99, categoría ≤ 20 caracteres) y `upsert` por `workspaceId`.
- [ ] Pruebas: aislamiento entre workspaces, permisos, topes, pedidos cancelados fuera, cuotas pagadas fuera.
- [ ] Commit `Informes: lectura de datos, acceso y ajustes`.

### Task 3: Pantallas, desglose, CSV y menú
**Files:** `app/(shell)/informes/{layout,page}.tsx`, `app/(shell)/informes/{resultados,resultados/detalle,flujo,flujo/detalle,monotributo,ajustes}/page.tsx`,
`components/informes/*` (pestañas, filtro de período, tabla de matriz, semáforo),
`app/api/informes/[informe]/csv/route.ts`, `components/shell/shell-nav.tsx`, `lib/shell/nav-keywords.ts`,
enlaces desde `app/(shell)/caja/reportes/page.tsx` y `app/(shell)/pedidos/informes/page.tsx`.

- [ ] Tablero con tarjetas enlazadas a cada informe.
- [ ] Resultados: selector de vista (Lo cobrado y pagado / Lo vendido y comprometido), período, matriz con
  bloques, subtotales por padre, rubros inactivos marcados, rojo en negativos, aviso "Sin clasificar" con
  enlace a Configuración → Rubros y sugerencia de grupo 5; cada celda enlaza al detalle.
- [ ] Detalle de Resultados: lista de movimientos / pedidos / cuentas a pagar de la celda (fecha, origen,
  contacto, descripción, importe, enlace al pedido), total.
- [ ] Flujo: agrupar y horizonte, fila Hoy, filas, "Sin fecha", rojo bajo mínimo; detalle por celda.
- [ ] Monotributo: barra por mes, total, porcentaje, semáforo, leyenda fija, invitación a configurar.
- [ ] Ajustes: formulario con `configurar`.
- [ ] CSV de Resultados (matriz y detalle), Flujo y Monotributo.
- [ ] Avisos cuando no hay datos ("Todavía no hay movimientos de Caja en este período").
- [ ] Menú "Informes" con subítems, palabras del buscador ⌘K, enlaces desde Caja → Reportes y
  Pedidos → Informes.
- [ ] Pruebas de páginas como las de `lib/presupuestos/pantallas.test.ts` si el patrón aplica; prueba del
  CSV (permiso y contenido).
- [ ] Commit `Informes: pantallas, desglose, CSV y menú`.

### Task 4: Documento de migración y verificación final
**Files:** `packages/db/docs/MIGRACION-ETAPA-6-INFORMES.md`.
- [ ] Documento: tabla, checksum (sha256 del `migration.sql`), SQL de verificación, vuelta atrás
  (`DROP TABLE`), encender el módulo `reports` en DNX, prueba en producción.
- [ ] Verificación completa de las Global Constraints (vitest, tsc, prisma, build).
- [ ] Commit `Informes: documento de migración`.
