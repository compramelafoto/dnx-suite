# ¿Cuánto Cobro?: local y coberturas separados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dentro de «Mi estudio», un modo que separa la cuenta del local (sólo informa, con semáforo medido con Caja) de la cuenta de las coberturas (la única que define el precio).

**Architecture:** El motor puro (`packages/cuanto-cobro-core/src/studio/`) gana un modo `separateLocal`. En ese modo `computeStudioBreakdownFor` llena los mismos campos de siempre (`ownerDraw`, `fixedCosts`, `teamCost`, `otherLinesContribution`) con los valores de coberturas, así `calculateCuantoCobro` y `hourly-rates` no cambian de forma; agrega una clave `separated` con el detalle. La cuenta del local es otra función pura que recibe las ventas ya sumadas. La app (FOTOFFICE) suma las ventas de Caja en el servidor, nunca el motor.

**Tech Stack:** TypeScript, Vitest, Next.js (App Router, ver `apps/fotoffice/AGENTS.md`: leer `node_modules/next/dist/docs/` antes de tocar páginas), Prisma (`@repo/db`), pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-28-cuanto-cobro-local-y-coberturas-design.md`

## Global Constraints

- Con `separateLocal` ausente o `false`, todos los números del motor quedan **idénticos** a hoy (tests existentes de `studio/` y `calculate-cuanto-cobro.characterization.test.ts` sin tocar).
- Sin migración: todo vive en el JSON `studioStructure` del perfil.
- Montos, porcentajes, días y horas como **texto** ("900000", "5,5"), igual que el resto del perfil.
- El motor sigue **puro**: nada de Prisma/Next/React en `packages/cuanto-cobro-core` (lo vigila `architecture.purity.test.ts`).
- El local **sólo avisa**: ningún dato del local entra en la necesidad de coberturas.
- Textos de pantalla en español rioplatense claro; montos con `pesos()` de `lib/presupuestos/editor`; montos de entrada con `InputMoneda`.
- Caja: `CashMovement.occurredAt` es `timestamp` **sin zona**: los límites de mes se arman como fechas de Argentina (ver `lib/dnx-bot/dia-argentino.ts`) y se comparan sin convertir.
- Comandos: `pnpm --filter @repo/cuanto-cobro-core test`, `pnpm --filter fotoffice test`, `pnpm --filter fotoffice typecheck`, `pnpm --filter @repo/cuanto-cobro-core typecheck`. Correr `pnpm install` una vez en el worktree antes de la primera tarea.

## Review Focus

1. **Perfil sin gastos personales cargados con el modo encendido** → el cálculo queda «incompleto» con el faltante «Tus gastos personales», nunca un precio con necesidad 0. (Task 2)
2. **Sueldo del local mayor que los gastos personales** → la necesidad personal neta es 0 (no negativa) y aparece el aviso «Lo que te paga el local cubre todos tus gastos personales». (Task 2)
3. **Parte cobrable mayor que 100 − tiempo en el local** → error al guardar en el formulario y aviso en el motor; el motor igual calcula. (Tasks 2 y 6)
4. **Movimientos de Caja anulados o transferencias** → no suman ventas (excluir `reversesMovementId` no nulo, los movimientos revertidos y `transferId` no nulo). (Task 5)
5. **Persona del local asignada a un evento** → sus horas se cobran a su costo por hora, sin recargo de estructura, y no agregan capacidad. (Task 2)

---

### Task 1: Tipos y normalización del modo separado

**Files:**
- Modify: `packages/cuanto-cobro-core/src/studio/types.ts`
- Modify: `packages/cuanto-cobro-core/src/studio/normalize.ts`
- Modify: `packages/cuanto-cobro-core/src/index.ts` (exportar lo nuevo)
- Test: `packages/cuanto-cobro-core/src/studio/local.test.ts` (nuevo)

**Interfaces:**
- Produces:
  - `type StudioScope = "local" | "coverage" | "shared"`
  - `StudioFixedCostItem.scope?: StudioScope`; `StudioPerson.scope?: "local" | "coverage"`
  - En `CuantoCobroStudioStructure`: `separateLocal?: boolean; coverageSharePercent?: string; ownerLocalTimePercent?: string; ownerLocalSalaryMonthly?: string; localGoodsCostPercent?: string; localMonthlyContributionManual?: string`
  - `defaultFixedCostScope(groupId: string): StudioScope` — `premises|utilities|insurance|maintenance|other` → `"local"`; `software|marketing|admin` → `"shared"`; cualquier otro → `"local"`.
  - `fixedCostScope(groupId: string, item: StudioFixedCostItem): StudioScope` — `item.scope ?? defaultFixedCostScope(groupId)`.
  - `personScope(person: StudioPerson): "local" | "coverage"` — el dueño siempre `"coverage"`; el resto `person.scope ?? "local"`.
  - `effectiveCoverageSharePercent(s: CuantoCobroStudioStructure): number` — `coverageSharePercent` si es válido; si no, `100 − ownerLocalTimePercent` (vacío = 0) .
  - `isSeparateLocalActive(profile: Pick<CuantoCobroProfileInput, "studioStructure">): boolean` — modo estudio activo **y** `separateLocal === true`.

- [ ] **Step 1: Tests que fallan** en `local.test.ts`:
  - `normalizeStudioStructure` conserva `separateLocal: true`, los cinco campos de texto (recortados a 20) y `scope` válido en renglones y personas; descarta `scope: "otro"` y `scope` de persona `"shared"`.
  - Un bloque sin los campos nuevos normaliza **sin** agregarlos (igualdad estricta con el resultado de hoy).
  - `defaultFixedCostScope("premises") === "local"`, `("software") === "shared"`, `("marketing") === "shared"`, `("desconocido") === "local"`.
  - `personScope` del dueño con `scope: "local"` → `"coverage"`.
  - `effectiveCoverageSharePercent({ownerLocalTimePercent:"20"}) === 80`; con `coverageSharePercent:"70"` → `70`; ambos vacíos → `100`.
- [ ] **Step 2:** `pnpm --filter @repo/cuanto-cobro-core test -- studio/local` → FAIL (no existen).
- [ ] **Step 3:** Implementar en `types.ts` y `normalize.ts` (mismo estilo que `cashCategoryIds`: sólo se copia si viene y es válido).
- [ ] **Step 4:** Mismo comando → PASS; `pnpm --filter @repo/cuanto-cobro-core test` → todo PASS.
- [ ] **Step 5: Commit** `git commit -m "Mi estudio: tipos del modo local y coberturas"`

### Task 2: Cuenta de las coberturas en el motor

**Files:**
- Modify: `packages/cuanto-cobro-core/src/studio/capacity.ts`
- Modify: `packages/cuanto-cobro-core/src/studio/types.ts` (tipo del desglose)
- Modify: `packages/cuanto-cobro-core/src/calculate-cuanto-cobro.ts:110-120` (paso nuevo)
- Modify: `packages/cuanto-cobro-core/src/__fixtures__/studio-fixtures.ts` (fixture de Daniel)
- Test: `packages/cuanto-cobro-core/src/studio/local.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `CuantoCobroStudioBreakdown.separated?: StudioCoverageAccount` con
    `{ personalNeed: number; localSalary: number; externalIncome: number; ownerNetNeed: number; sharedFixed: number; sharedToCoverage: number; coverageFixed: number; coverageTeamCost: number }`.
  - En modo separado, `computeStudioBreakdownFor` devuelve: `ownerDraw = ownerNetNeed`, `fixedCosts = coverageFixed + sharedToCoverage`, `teamCost = coverageTeamCost + insumos del dueño`, `otherLinesContribution = 0`; `capacityHours` = horas vendibles del dueño + personas `coverage`; personas `local`: `billableHours` propias, `rate = costPerHour` (sin estructura), no suman a `capacityHours` ni a `directCostWithHours`.
  - `CuantoCobroStudioStepId` suma `"studio-local"`; `getStudioMissingFields("studio-local", profile)` pide «Tus gastos personales» (suma 0) y «Lo que te paga el local» (vacío; 0 es válido). Sólo se agrega a `STUDIO_PROFILE_RESULT_STEPS` cuando `isSeparateLocalActive` (función nueva `getProfileResultSteps` ya existe: extenderla).

Fórmulas (spec §4.3): `personalNeed = sumPersonalExpenseGroups(profile.personalExpenseGroups)`; `externalIncome` sólo si `livesOnlyFromPhotography === "no"`; `ownerNetNeed = max(0, personalNeed − localSalary − externalIncome)`; costo del dueño = `ownerNetNeed + insumos`; `base = ownerNetNeed + sharedToCoverage + coverageFixed + coverageTeamCost + reservas + fijosDeImpuestos`; ganancia como hoy; reservas como hoy.

Avisos nuevos (texto exacto): `"Lo que te paga el local cubre todos tus gastos personales: revisá esos montos."` cuando `personalNeed > 0 && ownerNetNeed === 0`; `"Tu parte cobrable no puede ser mayor que el tiempo que no le das al local."` cuando cobrable del dueño > 100 − `ownerLocalTimePercent`.

- [ ] **Step 1: Fixture** `perfilDanielSeparado(): CuantoCobroProfileInput` en `studio-fixtures.ts`, con los datos del spec §2: fijos rent 450000, power-gas-water 230000, internet-phone 30000, expensas 80000 y agua 45000 (renglones propios en `utilities`), software 30000, ads 100000; dueño 5 días × "9,6" h, cobrable "50"; Camila y Sabina informales 900000, 5 × 5 h, `scope: "local"`; `ownerDrawMonthly: "1000000"` (debe ignorarse); `separateLocal: true`, `ownerLocalTimePercent: "20"`, `ownerLocalSalaryMonthly: "1000000"`; perfil con gastos personales que sumen 3168000, `livesOnlyFromPhotography: "no"`, `externalMonthlyIncome: "200000"`, `equipmentRenewalMonthly: "41667"`, `emergencyFundMonthly: "50000"`, `savingsGoalsMonthly: "120000"`, `commercialPositioningId: "growing"`.
- [ ] **Step 2: Tests que fallan** (`describe("Local y coberturas: los números de Daniel")`):
  - `computeStudioBreakdown(perfilDanielSeparado())!.monthlyNeed` ≈ `2163667` (±1).
  - `.separated!.sharedToCoverage === 104000`, `.coverageFixed === 0`, `.ownerNetNeed === 1968000`.
  - tarifa del dueño (`people.find(p => p.id === "owner").rate`) ≈ `20821` (±1).
  - Camila: `rate` ≈ `975000 / billableHours` (sin estructura) y `capacityHours` ≈ horas vendibles del dueño (≈103,9).
  - Propiedad: Σ `rate × billableHours` de personas que suman capacidad = `monthlyNeed` (±1).
  - Cambiar `rent` a 900000 o el sueldo de Camila a 2000000 no cambia la tarifa del dueño.
  - Mismo perfil con `separateLocal: false` da exactamente lo que da hoy `computeStudioBreakdown` (snapshot de los campos numéricos tomado antes de implementar).
  - Review Focus 1: gastos personales vacíos → `getStudioMissingFields("studio-local", p)` contiene `"Tus gastos personales"` y `calculateCuantoCobro` devuelve `status: "incomplete"`.
  - Review Focus 2: `ownerLocalSalaryMonthly: "5000000"` → `ownerNetNeed === 0` y el aviso exacto.
  - Review Focus 3: cobrable `"90"` con local `"20"` → el aviso exacto, y el cálculo sigue.
  - Review Focus 5: persona `local` asignada 3 h de cobertura en un concepto → `laborByPerson` la cobra a su `costPerHour` y `atStudioRate: false`.
- [ ] **Step 3:** `pnpm --filter @repo/cuanto-cobro-core test -- studio` → FAIL.
- [ ] **Step 4:** Implementar en `capacity.ts` (rama `separateLocal` dentro de `computeStudioBreakdownFor`; las fórmulas de arriba) y el paso en `calculate-cuanto-cobro.ts`.
- [ ] **Step 5:** `pnpm --filter @repo/cuanto-cobro-core test` → todo PASS (los tests viejos de `studio/` y de caracterización intactos).
- [ ] **Step 6: Commit** `git commit -m "Mi estudio: la cuenta de las coberturas sin el local"`

### Task 3: Precio de punta a punta y horas que cuentan doble

**Files:**
- Test: `packages/cuanto-cobro-core/src/studio/local.test.ts`
- Modify (sólo si el test de horas falla): `packages/cuanto-cobro-core/src/quote-item-calculations.ts` / `quote-item-hours.ts`

**Interfaces:**
- Consumes: `perfilDanielSeparado()` (Task 2), `calculateCuantoCobro(profile, quote)`.

- [ ] **Step 1: Tests**:
  - `sesionPreXv()`: un concepto `own-service` «Sesión PRE XV con maquillaje y fiesta completa», `coverageHours "11"`, `editingHours "11"`, `salesHours "2"`, `travelHours "1"`, `deliveryHours "1"`, `directCost "50000"`, asignaciones al `owner`: coverage 11, editing 11, travel 1, delivery 1. Con `perfilDanielSeparado()`: `totalJobHours === 26`, `hourlyRate` del dueño ≈ 20821 y precio (`priceBuildUp?.priceWithoutVat ?? chosenPriceEffective`) ≈ `650466` (±2).
  - Mismo con `commercialPositioningId: "established"` → ≈ `887000` (±2).
  - Doble conteo (spec §10): el mismo concepto **sin** las asignaciones de travel y delivery da también `totalJobHours === 26`.
- [ ] **Step 2:** `pnpm --filter @repo/cuanto-cobro-core test -- studio/local` → si algún total da 27, buscar en `accumulateActivity`/`sumOwnServiceHours` por qué se suma dos veces y corregir para que la asignación reemplace, no sume, a las horas del campo. Si da 26 en los dos casos, no se toca código.
- [ ] **Step 3:** `pnpm --filter @repo/cuanto-cobro-core test` → PASS.
- [ ] **Step 4: Commit** `git commit -m "Mi estudio: precio de punta a punta con local separado"`

### Task 4: Cuenta del local (función pura)

**Files:**
- Create: `packages/cuanto-cobro-core/src/studio/local-account.ts`
- Modify: `packages/cuanto-cobro-core/src/index.ts`
- Test: `packages/cuanto-cobro-core/src/studio/local-account.test.ts`

**Interfaces:**
- Consumes: Task 1 (`fixedCostScope`, `personScope`, `effectiveCoverageSharePercent`), `computeStudioPersonMonthlyCost`.
- Produces:
  ```ts
  export type StudioLocalSales = { months: { month: string; sales: number }[] }; // AAAA-MM, meses completos, el más reciente primero
  export type StudioLocalAccount = {
    costs: { fixed: number; shared: number; team: number; ownerSalary: number; total: number };
    status: "sin-datos" | "estimado" | "medido";
    months: { month: string; sales: number; leaves: number; result: number }[]; // leaves = sales × (1 − mercadería%)
    averageLeaves: number | null;
    averageResult: number | null; // averageLeaves − costs.total
  };
  export function computeStudioLocalAccount(profile: CuantoCobroProfileInput, sales: StudioLocalSales | null): StudioLocalAccount | null;
  ```
  `null` si el modo separado no está activo. `status`: ≥ 2 meses en `sales` → `"medido"` (promedio de hasta 3); si no, con `localMonthlyContributionManual` → `"estimado"` (`averageLeaves` = ese monto, `months` = los que haya); si no, `"sin-datos"` con promedios `null`.

- [ ] **Step 1: Tests**: con `perfilDanielSeparado()` y `localGoodsCostPercent: "40"`:
  - `costs.fixed === 835000`, `costs.shared === 26000`, `costs.team === 1950000`, `costs.ownerSalary === 1000000`, `costs.total === 3811000`.
  - `sales: { months: [{month:"2026-12",sales:5000000},{month:"2026-11",sales:4000000}] }` → `"medido"`, `averageLeaves === 2700000`, `averageResult === -1111000`.
  - Un solo mes + manual "3000000" → `"estimado"`, `averageLeaves === 3000000`.
  - Sin ventas ni manual → `"sin-datos"`, `averageResult === null`.
  - Modo apagado → `null`.
  - El resultado del local no cambia `computeStudioBreakdown(...).monthlyNeed` (llamarlas juntas).
- [ ] **Step 2:** `pnpm --filter @repo/cuanto-cobro-core test -- local-account` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mi estudio: la cuenta del local"`

### Task 5: Ventas del local desde Caja (servidor)

**Files:**
- Create: `apps/fotoffice/lib/precios/local-servidor.ts` (`import "server-only"`)
- Create: `apps/fotoffice/lib/precios/local.ts` (puro)
- Test: `apps/fotoffice/lib/precios/local.test.ts`
- Modify: `apps/fotoffice/lib/precios/estudio-servidor.ts` (`datosDeMiEstudio` devuelve además lo de abajo)

**Interfaces:**
- Consumes: `StudioLocalSales` (Task 4).
- Produces:
  - `mesesCompletos(hoyAR: string /* AAAA-MM-DD */, cantidad = 3): { month: string; desde: string; hasta: string }[]` — los meses calendario completos anteriores al mes de `hoyAR`, el más reciente primero; `desde` = primer día, `hasta` = primer día del mes siguiente (exclusivo).
  - `sumarVentasPorMes(filas: { occurredAt: Date; amountArs: number }[], meses): StudioLocalSales` — sólo meses con al menos un movimiento cuentan; un mes sin movimientos no entra.
  - `ventasDelLocal(workspaceId: string, estructura: CuantoCobroStudioStructure, hoyAR: string): Promise<StudioLocalSales | null>` — `null` si ninguna línea con `sellsHours: false` tiene `cashCategoryIds`. Filtra `kind: "INGRESO"`, `categoryId in` esas categorías, `transferId: null`, `reversesMovementId: null`, y excluye movimientos que tengan un contramovimiento (otro movimiento con `reversesMovementId` = su id).
  - `datosDeMiEstudio` suma `categoriasIngreso: { id: string; nombre: string }[]` (activas, `kind: "INGRESO"`, por `order`) y `ventasLocal: StudioLocalSales | null`.

Diferencia con el spec §6 (decisión del plan): las ventas **no** se guardan en el perfil (`localCashSummary`); se calculan al abrir la pantalla. Como el local sólo informa y nunca entra en el precio, guardarlas no aporta y quedarían viejas.

- [ ] **Step 1: Tests de las funciones puras**: `mesesCompletos("2026-10-28")` → `["2026-09","2026-08","2026-07"]` con `desde "2026-09-01"`, `hasta "2026-10-01"`; enero → diciembre del año anterior. `sumarVentasPorMes` con un movimiento el `2026-09-30T23:30:00` (sin zona) lo cuenta en septiembre; un mes sin filas no aparece.
- [ ] **Step 2:** `pnpm --filter fotoffice test -- lib/precios/local` → FAIL.
- [ ] **Step 3:** Implementar; `hoyAR` sale de `lib/dnx-bot/dia-argentino.ts` (reusar lo que exporte; si no exporta el día, agregar ahí una función `hoyArgentina(): string` con su test).
- [ ] **Step 4:** PASS, y `pnpm --filter fotoffice typecheck` sin errores.
- [ ] **Step 5: Commit** `git commit -m "Precios: ventas del local desde Caja"`

### Task 6: Pantalla «Local y coberturas» y resumen con semáforo

**Files:**
- Create: `apps/fotoffice/app/workspace/configuracion/precios/secciones-local.tsx`
- Modify: `apps/fotoffice/app/workspace/configuracion/precios/perfil-form.tsx` (paso `studio-local` en `PASOS_ESTUDIO` después de `studio-owner`, sólo si `separateLocal`; `CONTENIDO_ESTUDIO`)
- Modify: `apps/fotoffice/app/workspace/configuracion/precios/secciones-estudio.tsx` (`SeccionResumenEstudio`: dos recuadros; en modo separado ocultar «Tu retiro» de `SeccionVosEnElEstudio` y «Lo que dejan otras líneas» de `SeccionOtrasLineas`)
- Modify: `apps/fotoffice/app/workspace/configuracion/precios/page.tsx` (pasar `categoriasIngreso` y `ventasLocal`)
- Modify: `apps/fotoffice/lib/precios/estudio.ts` (`errorDeEstudio`, `separarLocal`)
- Modify: `apps/fotoffice/lib/presupuestos/calculo-cuanto-cobro.ts` y `constantes.ts` (`InstantaneaCalculo.modo?: "separado"`, sólo cuando `resultado.studio?.separated` existe — spec §5)
- Test: `apps/fotoffice/lib/precios/estudio.test.ts`, `apps/fotoffice/app/workspace/configuracion/precios/secciones-estudio.test.ts`, `apps/fotoffice/lib/presupuestos/calculo-cuanto-cobro.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces: `separarLocal(e: CuantoCobroStudioStructure): CuantoCobroStudioStructure` — enciende `separateLocal`, completa `scope` de cada renglón con `defaultFixedCostScope` y de cada persona no dueña con `"local"`, `ownerLocalTimePercent` vacío → `"20"`, y en cada línea `sellsHours: false` sin categorías no toca nada (lo elige la persona).

Contenido del paso (en este orden): interruptor «Separar el local de las coberturas» (ayuda: «El local paga sus gastos y tu sueldo; las coberturas pagan lo que necesitás para vivir. Lo que pase en el local nunca cambia el precio de tus eventos.»); `SeccionGastosPersonales` reusada; «Lo que te paga el local por mes» (`InputMoneda`); «Tu tiempo en el local (%)»; «Gastos compartidos que van a coberturas (%)» con el valor por defecto mostrado; por renglón de gasto fijo y por persona, un selector Local / Coberturas / Compartido (personas: Local / Coberturas); por cada línea que no vende horas, selector múltiple de `categoriasIngreso`; «Costo de la mercadería (% de lo que vendés)»; «Lo que deja el local por mes (estimado)».

Resumen en modo separado: recuadro **«Tus coberturas»** (necesidad, horas vendibles, tu hora) y **«El local»** (gastos totales desglosados, lo que deja, semáforo): `"medido"` → verde «Se pagó solo y sobraron $X» / rojo «Le faltaron $X», con la lista de meses; `"estimado"` → mismo texto con la etiqueta «estimado»; `"sin-datos"` → «Todavía no hay datos: elegí las categorías de Caja de tus ventas o cargá un estimado».

- [ ] **Step 1: Tests** en `estudio.test.ts`: `separarLocal` sobre el bloque de Daniel deja `rent→local`, `software→shared`, `ads→shared`, Camila y Sabina `local`, `ownerLocalTimePercent "20"`; `errorDeEstudio` devuelve `"Revisá lo que te paga el local."` con `ownerLocalSalaryMonthly "abc"`, `"Revisá tu tiempo en el local."` con `"120"`, y `"Tu parte cobrable no puede ser mayor que el tiempo que no le das al local."` con cobrable `"90"` y local `"20"`. En `secciones-estudio.test.ts`: el resumen en modo separado muestra «Tus coberturas» y «El local» y el texto de `"sin-datos"`. En `calculo-cuanto-cobro.test.ts`: con un perfil separado la instantánea trae `modo: "separado"`; sin el modo, no trae la clave.
- [ ] **Step 2:** `pnpm --filter fotoffice test -- precios` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS; `pnpm --filter fotoffice typecheck` sin errores.
- [ ] **Step 5:** Verificación visual con el servidor de desarrollo (preview_start de la app fotoffice): encender el modo en un perfil de prueba, ver el paso y el resumen; captura de pantalla.
- [ ] **Step 6: Commit** `git commit -m "Precios: paso Local y coberturas y semáforo del local"`

### Task 7: DNX Bot

**Files:**
- Modify: `apps/fotoffice/lib/dnx-bot/motor.ts` (esquema del parche ~l.193, aplicación ~l.531, resumen ~l.711, `camposDelEstudio` ~l.847)
- Modify: `apps/fotoffice/lib/dnx-bot/guia/perfil.ts`
- Modify: `apps/fotoffice/lib/dnx-bot/borrador.ts` (si lista claves del estudio)
- Test: `apps/fotoffice/lib/dnx-bot/motor-estudio.test.ts`

**Interfaces:**
- Consumes: Task 1, `separarLocal` (Task 6).
- Produces: en `parche.estudio`: `separarLocal?: boolean`, `sueldoDelLocal?: montoMes`, `tiempoEnElLocal?: porcentaje`, `compartidoCoberturas?: porcentaje`, `costoMercaderia?: porcentaje`, `localEstimado?: montoMes`; en `gastosFijos[]` y `personas[]`: `de?: "local" | "coberturas" | "compartido"` (personas sin `"compartido"`).

- [ ] **Step 1: Tests**: parche `{ estudio: { separarLocal: true, sueldoDelLocal: "1000000", tiempoEnElLocal: "20" } }` sobre el perfil de Daniel → `separateLocal true`, scopes por defecto (vía `separarLocal`), sueldo y tiempo cargados; `de: "compartido"` en `gastosFijos` pone `scope: "shared"`; `tiempoEnElLocal: "120"` → error «Tu tiempo en el local: tiene que ser un porcentaje entre 0 y 100.»; `camposDelEstudio` muestra «Lo que te paga el local» y deja de mostrar «Tu retiro» en modo separado.
- [ ] **Step 2:** `pnpm --filter fotoffice test -- dnx-bot/motor-estudio` → FAIL.
- [ ] **Step 3:** Implementar. Guía: en modo separado preguntar, de a una cosa, gastos personales, cuánto le paga el local, qué parte de su tiempo le da al local, cuántos eventos hace por mes (para la parte cobrable), y qué categorías de Caja son ventas del local (eso se elige en la pantalla: decirle dónde). No preguntar retiro ni «lo que dejan otras líneas». Las cifras siguen saliendo de `simular_perfil`.
- [ ] **Step 4:** PASS; `pnpm --filter fotoffice test -- dnx-bot` todo PASS (incluido `arquitectura.test.ts`).
- [ ] **Step 5: Commit** `git commit -m "DNX Bot: local y coberturas en Mi estudio"`

### Task 8: Verificación final

- [ ] **Step 1:** `pnpm --filter @repo/cuanto-cobro-core test && pnpm --filter @repo/cuanto-cobro-core typecheck && pnpm --filter fotoffice test && pnpm --filter fotoffice typecheck` → todo PASS. Si el typecheck termina sin salida por falta de memoria, repetir con `NODE_OPTIONS=--max-old-space-size=8192` (puede morir y devolver éxito: mirar que haya terminado de verdad).
- [ ] **Step 2:** `pnpm --filter fotoffice build` → sin errores (el build chequea tipos de los tests).
- [ ] **Step 3:** Con el perfil real de DNX Estudio (leído de la base de producción, sólo lectura) más `separateLocal: true`, `ownerLocalSalaryMonthly "1000000"`, `ownerLocalTimePercent "20"` y scopes por defecto, correr el motor fuera del repo y comprobar: tarifa del dueño ≈ $20.821 y sesión PRE XV 26 h ≈ $887.000 con «Marca consolidada».
- [ ] **Step 4:** Abrir PR contra `main` con el spec, el plan y el código. Encender el modo en el perfil de Daniel **sólo con su OK**, después de fusionar y desplegar.
