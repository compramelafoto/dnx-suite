# Equipo · Etapa 0: saldo inicial de cuenta de caja — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una cuenta de caja pueda tener un **saldo inicial** que sume a su saldo pero no cuente como ingreso del negocio en Caja → Reportes ni en Informes.

**Architecture:** Sin migración. Un saldo inicial es un `CashMovement` INGRESO con `sourceModule = "saldo-inicial"`, sin categoría y sin turno. Los mismos tres lugares que hoy excluyen las patas de un pase (`periodSummary`, `totalsByCategory` y `asientoDeMovimiento`) pasan a excluir también este origen. Su anulación conserva el origen, así que la anulación tampoco cuenta. Se carga desde Caja → Configuración, en la tarjeta de cada cuenta.

**Tech Stack:** Next.js (App Router, server actions), Prisma, Vitest. Para las pruebas: `cd apps/fotoffice && npx vitest run <archivo>`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-equipo-jornadas-alertas-liquidacion-design.md` §9.

## Global Constraints

- `CashMovement` no cambia de esquema. El saldo inicial se reconoce **sólo** por `sourceModule === "saldo-inicial"`.
- Importes en centavos enteros dentro de `lib/cash/*` (`parseArsToMinor`, `minorToDecimalString`, `decimalArsToMinor`).
- Textos de pantalla en castellano rioplatense, con el mismo tono que el resto de Caja.
- Sólo quien pasa `requireCashConfigurer()` carga un saldo inicial.
- Una cuenta tiene **a lo sumo un saldo inicial vigente**, es decir, no anulado.
- El saldo inicial **suma al saldo de la cuenta** (`accountBalanceMinor`, `balancesByAccountMinor` y los saldos de `flujo-datos` no cambian).

## Review Focus

1. **Anular un saldo inicial:** ni el original ni el contramovimiento aparecen como ingreso o egreso en ningún reporte, y el contramovimiento no entra en el arqueo del turno abierto. Pruebas en las Tareas 2, 3 y 4.
2. **Saldo inicial en una caja de mostrador con turno abierto:** no cambia lo esperado en el arqueo (`shiftId` nulo). Prueba en la Tarea 5.
3. **Segundo saldo inicial en la misma cuenta, sin anular el primero:** se rechaza con un mensaje que explica cómo corregirlo. Si el primero ya está anulado, se acepta. Prueba en la Tarea 5.
4. **Cuenta de otro workspace o fecha futura:** se rechaza. Pruebas en las Tareas 1 y 5.
5. **El listado de Informes → Detalle** (que usa `asientosDeCaja`) no muestra el saldo inicial. Queda cubierto por la Tarea 3, porque Detalle llama a `asientoDeMovimiento`.

---

### Task 1: Validación pura del saldo inicial

**Files:**
- Create: `apps/fotoffice/lib/cash/opening-balance.ts`
- Test: `apps/fotoffice/lib/cash/opening-balance.test.ts`

**Interfaces:**
- Produces:
  - `export const OPENING_BALANCE_MODULE = "saldo-inicial" as const;`
  - `export function isOpeningBalanceModule(sourceModule: string | null | undefined): boolean`
  - `export type OpeningBalanceValues = { accountId: string; amountMinor: number; occurredAt: Date; note: string | null }`
  - `export function parseOpeningBalanceForm(fd: FormData, now: Date): { ok: true; values: OpeningBalanceValues } | { ok: false; error: string }`
  - `export function openingBalanceDescription(note: string | null): string`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
describe("parseOpeningBalanceForm", () => {
  const ahora = new Date("2026-10-21T15:00:00Z");
  it("acepta importe con formato argentino y fecha pasada", () => {
    const r = parseOpeningBalanceForm(fd({ accountId: "a1", amountArs: "193.900", occurredAt: "2026-10-19", note: "" }), ahora);
    expect(r).toEqual({ ok: true, values: { accountId: "a1", amountMinor: 19390000, occurredAt: expect.any(Date), note: null } });
  });
  it("la fecha se toma a las 00:00 hora argentina", () => {
    const r = parseOpeningBalanceForm(fd({ accountId: "a1", amountArs: "100", occurredAt: "2026-10-19" }), ahora);
    expect(r.ok && r.values.occurredAt.toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });
  it("rechaza importe cero o ilegible", () => { /* "0" y "abc" → ok:false */ });
  it("rechaza fecha futura", () => { /* "2026-10-22" → ok:false, error "La fecha del saldo inicial no puede ser futura." */ });
  it("rechaza sin cuenta", () => { /* accountId "" → ok:false */ });
});
describe("isOpeningBalanceModule", () => {
  it("reconoce sólo saldo-inicial", () => {
    expect(isOpeningBalanceModule("saldo-inicial")).toBe(true);
    expect(isOpeningBalanceModule("manual")).toBe(false);
    expect(isOpeningBalanceModule(null)).toBe(false);
  });
});
it("openingBalanceDescription", () => {
  expect(openingBalanceDescription(null)).toBe("Saldo inicial");
  expect(openingBalanceDescription("lo que había antes del sistema")).toBe("Saldo inicial: lo que había antes del sistema");
});
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run lib/cash/opening-balance.test.ts`. Resultado esperado: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar `opening-balance.ts`.** El importe usa `parseArsToMinor`. La fecha llega como `AAAA-MM-DD` y se convierte a medianoche de `America/Argentina/Buenos_Aires` (UTC−3 fijo, como en el resto de `lib/cash/period.ts`). Si ya hay un helper de fecha argentina en `period.ts`, se reusa. El comentario de cabecera explica por qué es un origen y no una columna: `CashMovement` no cambia.
- [ ] **Step 4: Correr y ver que pasan.** Mismo comando. Resultado esperado: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Caja: validar el saldo inicial de una cuenta"`

### Task 2: Reportes de Caja sin el saldo inicial

**Files:**
- Modify: `apps/fotoffice/lib/cash/balance.ts` (`BalanceMovement`, `periodSummary`, `totalsByCategory`)
- Modify: `apps/fotoffice/lib/cash/repository.ts` (`movementsForReport`: seleccionar `sourceModule` y mapear)
- Test: `apps/fotoffice/lib/cash/balance.test.ts`

**Interfaces:**
- Consumes: `isOpeningBalanceModule` (Tarea 1).
- Produces: `BalanceMovement.isOpeningBalance?: boolean` (opcional, el mismo criterio que `isTransfer`).

- [ ] **Step 1: Pruebas que fallan**

```ts
it("periodSummary no cuenta el saldo inicial ni su anulación", () => {
  const r = periodSummary([
    { kind: "INGRESO", amountMinor: 19390000, isOpeningBalance: true },
    { kind: "EGRESO", amountMinor: 19390000, isOpeningBalance: true },
    { kind: "INGRESO", amountMinor: 1500000 },
  ]);
  expect(r).toEqual({ incomeMinor: 1500000, expenseMinor: 0, netMinor: 1500000 });
});
it("totalsByCategory no agrupa el saldo inicial", () => { /* un saldo inicial sin categoría → no aparece "Sin categoría" */ });
it("accountBalanceMinor sí suma el saldo inicial", () => {
  expect(accountBalanceMinor([{ kind: "INGRESO", amountMinor: 19390000, isOpeningBalance: true }, { kind: "EGRESO", amountMinor: 19480000 }])).toBe(-90000);
});
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run lib/cash/balance.test.ts`
- [ ] **Step 3: Implementar.** `periodSummary` y `totalsByCategory` saltean `m.isTransfer || m.isOpeningBalance`. Se actualiza el comentario de cabecera de `balance.ts`: un saldo inicial entra en el saldo y no en ingresos ni egresos, porque la plata ya estaba. `movementsForReport` agrega `sourceModule: true` al `select` y mapea `isOpeningBalance: isOpeningBalanceModule(r.sourceModule)`.
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit.** `git commit -m "Caja: el saldo inicial no es ingreso en los reportes"`

### Task 3: Informes sin el saldo inicial

**Files:**
- Modify: `apps/fotoffice/lib/informes/resultados.ts` (`asientoDeMovimiento`)
- Modify: `apps/fotoffice/lib/informes/detalle-datos.ts` (`ETIQUETAS_ORIGEN_CAJA`: `"saldo-inicial": "Saldo inicial"`)
- Test: `apps/fotoffice/lib/informes/resultados.test.ts` (bloque `describe("asientosDeCaja")`)

**Interfaces:**
- Consumes: `isOpeningBalanceModule` (Tarea 1).

- [ ] **Step 1: Pruebas que fallan**

```ts
it("un saldo inicial no genera asiento", () => {
  expect(asientosDeCaja([mov({ id: "s", kind: "INGRESO", categoryId: null, sourceModule: "saldo-inicial" })])).toEqual([]);
});
it("la anulación de un saldo inicial no genera asiento, aunque el original esté fuera del lote", () => {
  const anul = mov({ id: "x", kind: "EGRESO", reversesMovementId: "s", sourceModule: "saldo-inicial" });
  expect(asientosDeCaja([anul], [{ id: "s", kind: "INGRESO", categoryId: null, sourceModule: "saldo-inicial" }])).toEqual([]);
  expect(asientosDeCaja([anul])).toEqual([]); // sin el original a mano
});
```

(`mov` es el helper que ya usa el archivo. Si no existe, crearlo con los campos de `MovimientoCajaFila`.)

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run lib/informes/resultados.test.ts`
- [ ] **Step 3: Implementar.** En `asientoDeMovimiento`, justo después del chequeo de `transferId`: si `isOpeningBalanceModule(m.sourceModule)` → `null`. En la rama del original: si `isOpeningBalanceModule(original.sourceModule)` → `null`.
- [ ] **Step 4: Correr y ver que pasan.** Correr también `npx vitest run lib/informes`, porque los otros archivos de informes usan esta función.
- [ ] **Step 5: Commit.** `git commit -m "Informes: el saldo inicial queda afuera de resultados"`

### Task 4: Anular un saldo inicial conserva su origen

**Files:**
- Modify: `apps/fotoffice/lib/cash/reverse.ts` (`ReversibleMovement`, `ReversalValues`, `buildReversal`)
- Modify: `apps/fotoffice/app/(shell)/caja/actions.ts` (acción de anular, ~L253-325: pasar `sourceModule` y no asignar turno a la anulación de un saldo inicial)
- Test: `apps/fotoffice/lib/cash/reverse.test.ts`

**Interfaces:**
- Consumes: `OPENING_BALANCE_MODULE`, `isOpeningBalanceModule` (Tarea 1).
- Produces: `ReversibleMovement.sourceModule?: string`. Es opcional para no romper a `lib/pedidos/cobros.ts` ni a `lib/sales/void-sale.ts`. `ReversalValues.sourceModule: "manual" | typeof OPENING_BALANCE_MODULE`.

- [ ] **Step 1: Pruebas que fallan**

```ts
it("la anulación de un saldo inicial conserva el origen saldo-inicial", () => {
  const r = buildReversal({ ...base, sourceModule: "saldo-inicial" }, "faltaban 900 pesos");
  expect(r.ok && r.values.sourceModule).toBe("saldo-inicial");
});
it("cualquier otro movimiento sigue anulándose como manual", () => {
  const r = buildReversal({ ...base, sourceModule: "sales" }, "x");
  expect(r.ok && r.values.sourceModule).toBe("manual");
});
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run lib/cash/reverse.test.ts`
- [ ] **Step 3: Implementar.** En `buildReversal`: `sourceModule: isOpeningBalanceModule(original.sourceModule) ? OPENING_BALANCE_MODULE : "manual"`. En la acción de anular: pasar `sourceModule: original.sourceModule` a `buildReversal`. En el `create`, poner `shiftId: v.sourceModule === OPENING_BALANCE_MODULE ? null : turno?.id ?? null`: un saldo inicial nunca entró a un arqueo, así que su anulación tampoco.
- [ ] **Step 4: Correr y ver que pasan.** Correr también `npx vitest run lib/cash`.
- [ ] **Step 5: Commit.** `git commit -m "Caja: anular un saldo inicial no lo convierte en egreso"`

### Task 5: Cargar el saldo inicial desde Caja → Configuración

**Files:**
- Modify: `apps/fotoffice/lib/cash/repository.ts`, para agregar `openingBalancesByAccount`
- Modify: `apps/fotoffice/app/(shell)/caja/actions.ts`, para agregar `saveOpeningBalanceAction`
- Create: `apps/fotoffice/app/(shell)/caja/opening-balance-form.tsx`
- Modify: `apps/fotoffice/app/(shell)/caja/configuracion/page.tsx`, para mostrarlo debajo de cada `AccountForm`
- Create: `apps/fotoffice/lib/cash/opening-balance-rules.ts` y `opening-balance-rules.test.ts`, la regla pura de "ya tiene uno vigente"

**Interfaces:**
- Consumes: Tarea 1.
- Produces:
  - `export type OpeningBalanceRow = { movementId: string; amountMinor: number; occurredAt: Date }`
  - `export async function openingBalancesByAccount(workspaceId: string): Promise<Map<string, OpeningBalanceRow>>`. Devuelve sólo los vigentes: `sourceModule = "saldo-inicial"`, `kind = "INGRESO"`, `reversesMovementId = null` y sin `reversedBy`.
  - `export function canAddOpeningBalance(existing: OpeningBalanceRow | undefined): { ok: true } | { ok: false; error: string }`
  - `export async function saveOpeningBalanceAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Pruebas que fallan (regla pura)**

```ts
it("sin saldo inicial vigente, se puede cargar", () => expect(canAddOpeningBalance(undefined)).toEqual({ ok: true }));
it("con uno vigente, se rechaza y explica cómo corregirlo", () => {
  expect(canAddOpeningBalance({ movementId: "m", amountMinor: 1, occurredAt: new Date() })).toEqual({
    ok: false,
    error: "Esta cuenta ya tiene saldo inicial. Para corregirlo, anulalo en Movimientos y cargalo de nuevo.",
  });
});
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run lib/cash/opening-balance-rules.test.ts`
- [ ] **Step 3: Implementar la regla, el lector y la acción.**
  - **La acción** hace, en orden: `requireCashConfigurer()`, luego `parseOpeningBalanceForm(formData, new Date())`, luego verifica que la cuenta sea del workspace (si no, "Esa cuenta no existe."), luego `canAddOpeningBalance`, y por último `cashMovement.create`.
  - **El `create`** lleva `kind "INGRESO"`, `shiftId null`, `categoryId null` y `paymentMethod` `"EFECTIVO"` si la cuenta es EFECTIVO o `"OTRO"` si no. Además `description: openingBalanceDescription(note)`, `sourceModule: OPENING_BALANCE_MODULE`, `sourceRef null` y `createdByUserId`.
  - **Al terminar**, `revalidatePath` de Caja y Configuración, y `redirect` a Configuración con `?ok=1`. Los errores vuelven a Configuración con `?error=`, igual que `saveAccountAction`.
- [ ] **Step 4: Implementar el formulario.**
  - **Si la cuenta ya tiene saldo inicial**, el formulario muestra "Saldo inicial: 193.900 pesos al 19/10/2026" con `formatMinorArs` y un enlace a Movimientos.
  - **Si no tiene**, muestra un formulario chico, igual de discreto que "Abrir turno" en `account-card.tsx`. Lleva la fecha (`type="date"`, por defecto hoy), el importe (`ImporteConContador`, como en la apertura de turno), una nota opcional y el botón secundario "Cargar saldo inicial".
  - **Ayuda debajo:** "Es la plata que ya había en esta cuenta antes de empezar a usar FOTOFFICE. Suma al saldo, pero no cuenta como ingreso."
- [ ] **Step 5: Correr la regla y toda la caja.** `npx vitest run lib/cash lib/informes`. Resultado esperado: PASS. Después correr el typecheck de la app con el script que usa CI para FOTOFFICE.
- [ ] **Step 6: Probar en el navegador con `next dev --webpack`.** Cargar un saldo inicial en una cuenta de un workspace de prueba y verificar:
  - el saldo de la cuenta en `/caja` sube;
  - `/caja/reportes` no lo muestra como ingreso;
  - un segundo intento muestra el error;
  - al anularlo en Movimientos se puede volver a cargar.
- [ ] **Step 7: Commit.** `git commit -m "Caja: cargar el saldo inicial de una cuenta desde Configuración"`

### Task 6: Convertir el saldo inicial ya cargado en DNX Estudio

Se hace después de que el cambio esté en producción.

- [ ] **Step 1: Verificar el movimiento.** Proyecto Neon `divine-hall-10689679`, rama `br-old-rain-adwthzng`: `SELECT id, "sourceModule", "amountArs" FROM "CashMovement" WHERE id = 'cmfix1021saldoinicial'`. Resultado esperado: `manual`, `193900.00`.
- [ ] **Step 2: Convertirlo.** `UPDATE "CashMovement" SET "sourceModule" = 'saldo-inicial' WHERE id = 'cmfix1021saldoinicial' AND "sourceModule" = 'manual'`. Resultado esperado: 1 fila.
- [ ] **Step 3: Verificar.** El saldo de la Caja fuerte sigue en 0, e Informes de octubre de DNX Estudio ya no tiene los 193.900 pesos en "Sin rubro".
