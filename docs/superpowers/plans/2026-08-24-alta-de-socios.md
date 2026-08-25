# Alta de socios y primer cobro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un profesional se asocie desde un formulario público, la Secretaría lo apruebe, y pague sus tres cuotas de ingreso con MercadoPago — con la plata yendo directo a la institución y sin que nadie toque nada a mano.

**Architecture:** El alta y las cuotas son datos propios de FotoOffice; el cobro se delega a `@repo/payments` (Orders 1:N con split), que ya usan otros productos. Las cuotas se guardan como **cargos reales** desde el primer día, para que el módulo de cuotas mensuales encastre después sin recobrarle nada al socio.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers), Prisma, `@repo/payments`, MercadoPago Orders 1:N, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-fotoffice-alta-socios-cobros-design.md` (§5.3 a §5.6, §6, §8)

## Global Constraints

- **Dinero: nunca coma flotante.** `Prisma.Decimal` o centavos enteros. Se reutiliza `lib/platform-fee/fee.ts`, ya probado.
- **Invariante:** `fee + neto === total`, exacto, siempre.
- **La comisión sale de `getPlatformFeeBps(workspaceId, MEMBERS_MODULE_KEY)`.** Nunca un número escrito en el código.
- **No se cobra si `canReceiveSplit` es false.** Es la única fuente para decidir si la institución puede cobrar; hoy exige cuenta vinculada **y** consentimiento de split activo.
- **El número de socio se asigna al aprobar**, dentro de la transacción, con la restricción `[workspaceId, memberNumber]` como árbitro. Nunca "el último más uno" fuera de transacción.
- **Idempotencia del webhook por identificador del proveedor**, con restricción única en la base. La base es el árbitro, no un chequeo previo en memoria.
- **Vencimiento de cuota: día 10.** Cuotas de ingreso: 3. Ambos configurables por institución, con esos valores por defecto.
- **Nunca loguear tokens, códigos de autorización ni datos de tarjeta.**
- Tests: Vitest, `*.test.ts` al lado del fuente. Comentarios y textos **en español**.

## Prerrequisitos

| Qué | Estado |
|---|---|
| Comisión por workspace y módulo | ✅ en producción |
| Conexión de MercadoPago de la institución | ✅ en producción |
| Credenciales `FOTOFFICE_MP_*` | ❌ **faltan** |
| Consentimiento de split activo para la SFPR | ❌ **falta** (crearlo está limitado a sandbox en la plataforma) |

Las tareas 1 a 5 no dependen de nada de eso. **Las tareas 6 a 8 sí**: sin consentimiento activo, MercadoPago rechaza la orden con split.

## Lección del plan 2, que aplica acá

Un build local en verde **no predice producción**. El cambio de bundler pasó local y tiró la app abajo. En este plan hay dos pasos con el mismo perfil de riesgo —la migración y el webhook—: ambos se verifican con evidencia del entorno real, no con "compiló".

---

## File Structure

**Base de datos** (una migración, aditiva):

| Modelo | Qué guarda |
|---|---|
| `MembershipApplication` | Solicitud: datos declarados, estado, quién resolvió |
| `MembershipDuesSettings` | Por workspace: días, cantidad de cuotas iniciales, umbrales |
| `MembershipFeeValue` | Valor de referencia con vigencia |
| `MembershipCharge` | El cargo (cuota): socio, concepto, período, monto, vencimiento, saldo |
| `MembershipPayment` | El pago recibido, con su referencia de proveedor |
| `MembershipAllocation` | Imputación pago ↔ cargo |

Y sobre lo existente: atributos en `MemberCategory` (`grantsVote`, `eligibleForBoard`, `generatesDues`, `requiresConfirmation`) y en `Member` (escala, monto propio, motivo de baja, institución de procedencia).

**Lógica** (`apps/fotoffice/lib/membership/`):

| Archivo | Responsabilidad |
|---|---|
| `periods.ts` | Qué meses cubren las cuotas iniciales y cuándo vencen. **Puro** |
| `amounts.ts` | Monto según categoría y escala. **Puro** |
| `application.ts` | Validación de la solicitud |
| `approve.ts` | La transacción de aprobación |
| `charges.ts` | Generación y consulta de cargos |
| `checkout.ts` | Armado de la orden con split |
| `webhook.ts` | Procesamiento idempotente del pago |

**Superficies**: formulario público, bandeja de la Secretaría, pantalla de pago, ruta de webhook.

**Por qué así:** `periods.ts` y `amounts.ts` se separan porque son donde se esconden los errores que cuestan plata, y probarlos no debe requerir base de datos.

---

## Task 1: Qué meses cubren las cuotas iniciales

**Files:**
- Create: `apps/fotoffice/lib/membership/periods.ts`
- Test: `apps/fotoffice/lib/membership/periods.test.ts`

**Interfaces:**
- Produces:
  - `type DuePeriod = { period: string; dueDate: Date }` — `period` en formato `YYYY-MM`
  - `initialDuePeriods(input: { joinedAt: Date; count: number; dueDay: number; countJoinMonthIfBeforeDueDay: boolean }): DuePeriod[]`
  - `monthlyDuePeriod(period: string, dueDay: number): DuePeriod`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/lib/membership/periods.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialDuePeriods, monthlyDuePeriod } from "./periods";

const base = { count: 3, dueDay: 10, countJoinMonthIfBeforeDueDay: true };

describe("initialDuePeriods", () => {
  /** El ejemplo acordado con el titular: alta el 18, el mes en curso se bonifica. */
  it("alta el 18 de agosto cubre septiembre, octubre y noviembre", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  /** Quien entra antes del vencimiento alcanza a usar el mes: cuenta como la primera. */
  it("alta el 3 de agosto cubre agosto, septiembre y octubre", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-03T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("alta el 10 exacto todavía cuenta el mes en curso", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-10T12:00:00Z") });
    expect(r[0]!.period).toBe("2026-08");
  });

  it("alta el 11 ya no cuenta el mes en curso", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-11T12:00:00Z") });
    expect(r[0]!.period).toBe("2026-09");
  });

  it("con la opción apagada nunca cuenta el mes en curso", () => {
    const r = initialDuePeriods({
      ...base,
      countJoinMonthIfBeforeDueDay: false,
      joinedAt: new Date("2026-08-03T12:00:00Z"),
    });
    expect(r[0]!.period).toBe("2026-09");
  });

  it("cruza el fin de año correctamente", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-11-20T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("cada cuota vence el día 10 de su mes", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-09-10");
    expect(r[2]!.dueDate.toISOString().slice(0, 10)).toBe("2026-11-10");
  });

  it("respeta una cantidad distinta de cuotas", () => {
    const r = initialDuePeriods({ ...base, count: 1, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r).toHaveLength(1);
  });

  it("con count 0 no genera cuotas", () => {
    expect(initialDuePeriods({ ...base, count: 0, joinedAt: new Date("2026-08-18T12:00:00Z") })).toEqual([]);
  });

  it("no hay períodos repetidos", () => {
    const r = initialDuePeriods({ ...base, count: 12, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(new Set(r.map((d) => d.period)).size).toBe(12);
  });
});

describe("monthlyDuePeriod", () => {
  it("arma el vencimiento de un período dado", () => {
    expect(monthlyDuePeriod("2026-03", 10).dueDate.toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  /**
   * Febrero con día de vencimiento 30: se topea al último día del mes en vez de
   * desbordar a marzo, que es el error clásico de aritmética de fechas.
   */
  it("un día que no existe en el mes se topea al último día", () => {
    expect(monthlyDuePeriod("2026-02", 30).dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("año bisiesto", () => {
    expect(monthlyDuePeriod("2028-02", 30).dueDate.toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/membership/periods.test.ts
```

Esperado: FAIL — `Cannot find module './periods'`.

- [ ] **Step 3: Implementar**

Crear `apps/fotoffice/lib/membership/periods.ts`:

```ts
export type DuePeriod = {
  /** `YYYY-MM`. Identifica el mes que la cuota cubre. */
  period: string;
  dueDate: Date;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Último día del mes, para no desbordar cuando el día de vencimiento no existe. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Arma el vencimiento de un período.
 *
 * Si el día configurado no existe en ese mes (30 en febrero) se topea al último día:
 * desbordar al mes siguiente sería cobrar tarde y descuadrar la racha de mora.
 */
export function monthlyDuePeriod(period: string, dueDay: number): DuePeriod {
  const [y, m] = period.split("-").map(Number);
  const year = y!;
  const month1 = m!;
  const day = Math.min(dueDay, lastDayOfMonth(year, month1));
  return { period, dueDate: new Date(Date.UTC(year, month1 - 1, day)) };
}

/**
 * Meses que cubren las cuotas de ingreso.
 *
 * Regla acordada: las cuotas cubren los meses **siguientes** al ingreso y el mes en curso
 * queda bonificado — salvo que la persona se asocie **antes del vencimiento**, en cuyo
 * caso alcanza a usar el mes entero y este cuenta como la primera.
 *
 * No se cobran proporcionales a propósito: una cuota societaria es una membresía, no un
 * servicio medido. Cobrar medio mes introduce decimales y discusiones para siempre a
 * cambio de una fracción de cuota.
 */
export function initialDuePeriods(input: {
  joinedAt: Date;
  count: number;
  dueDay: number;
  countJoinMonthIfBeforeDueDay: boolean;
}): DuePeriod[] {
  if (input.count <= 0) return [];

  const year = input.joinedAt.getUTCFullYear();
  const month1 = input.joinedAt.getUTCMonth() + 1;
  const day = input.joinedAt.getUTCDate();

  const empiezaEsteMes = input.countJoinMonthIfBeforeDueDay && day <= input.dueDay;
  let y = year;
  let m = empiezaEsteMes ? month1 : month1 + 1;
  if (m > 12) {
    m -= 12;
    y += 1;
  }

  const out: DuePeriod[] = [];
  for (let i = 0; i < input.count; i++) {
    out.push(monthlyDuePeriod(`${y}-${pad(m)}`, input.dueDay));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/membership/periods.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/periods.ts apps/fotoffice/lib/membership/periods.test.ts
git commit -m "feat(fotoffice): initial dues periods and due dates"
```

---

## Task 2: Cuánto paga cada socio

**Files:**
- Create: `apps/fotoffice/lib/membership/amounts.ts`
- Test: `apps/fotoffice/lib/membership/amounts.test.ts`

**Interfaces:**
- Consumes: `Prisma` de `@repo/db`; `splitByPlatformFee` de `@/lib/platform-fee/fee`
- Produces:
  - `type FeeScale = "PLENA" | "REDUCIDA" | "EXENTA"`
  - `scaleMultiplier(scale: FeeScale): Prisma.Decimal`
  - `monthlyAmountFor(input: { referenceAmount: Prisma.Decimal; scale: FeeScale; ownAmount?: Prisma.Decimal | null; floorMultiple: number }): Prisma.Decimal`
  - `initialChargeTotal(monthly: Prisma.Decimal, count: number): Prisma.Decimal`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/lib/membership/amounts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { initialChargeTotal, monthlyAmountFor, scaleMultiplier } from "./amounts";

const d = (v: string) => new Prisma.Decimal(v);
const REF = d("10000");

describe("scaleMultiplier", () => {
  it.each([
    ["PLENA", "1"],
    ["REDUCIDA", "0.5"],
    ["EXENTA", "0"],
  ] as const)("%s vale %s", (scale, expected) => {
    expect(scaleMultiplier(scale).toString()).toBe(expected);
  });
});

describe("monthlyAmountFor", () => {
  it("el profesional paga la cuota plena", () => {
    expect(monthlyAmountFor({ referenceAmount: REF, scale: "PLENA", floorMultiple: 1 }).toFixed(2)).toBe("10000.00");
  });

  it("el estudiante paga la mitad", () => {
    expect(monthlyAmountFor({ referenceAmount: REF, scale: "REDUCIDA", floorMultiple: 1 }).toFixed(2)).toBe("5000.00");
  });

  it("el honorario no paga", () => {
    expect(monthlyAmountFor({ referenceAmount: REF, scale: "EXENTA", floorMultiple: 1 }).toFixed(2)).toBe("0.00");
  });

  it("el colaborador paga el monto que eligió", () => {
    const r = monthlyAmountFor({ referenceAmount: REF, scale: "PLENA", ownAmount: d("15000"), floorMultiple: 1 });
    expect(r.toFixed(2)).toBe("15000.00");
  });

  /** El piso existe para que "libre hacia arriba" no termine siendo hacia abajo. */
  it("un monto propio por debajo del piso se sube al piso", () => {
    const r = monthlyAmountFor({ referenceAmount: REF, scale: "PLENA", ownAmount: d("500"), floorMultiple: 1 });
    expect(r.toFixed(2)).toBe("10000.00");
  });

  it("respeta un piso distinto del valor de referencia", () => {
    const r = monthlyAmountFor({ referenceAmount: REF, scale: "PLENA", ownAmount: d("12000"), floorMultiple: 1.5 });
    expect(r.toFixed(2)).toBe("15000.00");
  });

  it("redondea a 2 decimales", () => {
    const r = monthlyAmountFor({ referenceAmount: d("3333.33"), scale: "REDUCIDA", floorMultiple: 1 });
    expect(r.toFixed(2)).toBe("1666.67");
  });
});

describe("initialChargeTotal", () => {
  it("tres cuotas plenas de 10.000 dan 30.000", () => {
    expect(initialChargeTotal(d("10000"), 3).toFixed(2)).toBe("30000.00");
  });

  it("tres cuotas reducidas dan la mitad", () => {
    expect(initialChargeTotal(d("5000"), 3).toFixed(2)).toBe("15000.00");
  });

  it("con cero cuotas el total es cero", () => {
    expect(initialChargeTotal(d("10000"), 0).toFixed(2)).toBe("0.00");
  });

  /** La suma de los cargos individuales tiene que dar exactamente el total cobrado. */
  it("el total es la suma exacta de las cuotas", () => {
    const monthly = d("3333.33");
    const total = initialChargeTotal(monthly, 3);
    expect(total.toFixed(2)).toBe(monthly.mul(3).toFixed(2));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/membership/amounts.test.ts
```

Esperado: FAIL — no existe `./amounts`.

- [ ] **Step 3: Implementar**

Crear `apps/fotoffice/lib/membership/amounts.ts`:

```ts
import { Prisma } from "@repo/db";

/**
 * Escala de cuota. Es ortogonal a la categoría: un estudiante y un profesional pueden ser
 * ambos socios activos con los mismos derechos, y diferir solo en cuánto pagan. Por eso la
 * escala vive en el socio y no en la categoría.
 */
export type FeeScale = "PLENA" | "REDUCIDA" | "EXENTA";

export function scaleMultiplier(scale: FeeScale): Prisma.Decimal {
  switch (scale) {
    case "PLENA":
      return new Prisma.Decimal(1);
    case "REDUCIDA":
      return new Prisma.Decimal("0.5");
    case "EXENTA":
      return new Prisma.Decimal(0);
  }
}

/**
 * Cuota mensual de un socio.
 *
 * Si tiene monto propio (colaborador) se usa ese, pero **nunca por debajo del piso**: el
 * aporte es libre hacia arriba, no hacia abajo.
 */
export function monthlyAmountFor(input: {
  referenceAmount: Prisma.Decimal;
  scale: FeeScale;
  ownAmount?: Prisma.Decimal | null;
  /** Múltiplo del valor de referencia que funciona como piso del aporte libre. */
  floorMultiple: number;
}): Prisma.Decimal {
  if (input.ownAmount) {
    const floor = input.referenceAmount.mul(input.floorMultiple);
    const elegido = input.ownAmount.lt(floor) ? floor : input.ownAmount;
    return elegido.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  return input.referenceAmount
    .mul(scaleMultiplier(input.scale))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Total de las cuotas de ingreso.
 *
 * Se multiplica el monto **ya redondeado** por la cantidad, para que el total cobrado sea
 * exactamente la suma de los cargos que se generan. Si se redondeara al final, el socio
 * pagaría un centavo distinto del que suman sus cuotas.
 */
export function initialChargeTotal(monthly: Prisma.Decimal, count: number): Prisma.Decimal {
  if (count <= 0) return new Prisma.Decimal(0);
  return monthly.mul(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/membership/amounts.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/amounts.ts apps/fotoffice/lib/membership/amounts.test.ts
git commit -m "feat(fotoffice): membership dues amounts by category scale"
```

---

## Tareas 3 a 8 — resumen y alcance

El detalle paso a paso de estas se escribe **al llegar a cada una**, porque varias dependen
de decisiones que se toman mejor con las anteriores ya funcionando. Lo que cubren:

### Task 3 — Modelo de datos

Migración aditiva con los seis modelos nuevos, más los atributos en `MemberCategory` y
`Member`. **Verificación obligatoria:** aplicar en una rama de Neon antes de producción, y
comprobar que el motor de Prisma sigue empaquetándose (`*.nft.json` con
`libquery_engine-rhel-openssl-3.0.x`). Esta es la lección del plan 2.

### Task 4 — Formulario público de solicitud

Datos personales, contacto con **domicilio de notificaciones** —sin él la baja por deuda es
nula—, categoría y escala declaradas, institución de procedencia si dice ser estudiante, y
foto. Límite de tasa por origen. **No se publica si la institución no tiene cobros
conectados**: el guard va en el origen, no en el final.

### Task 5 — Bandeja de la Secretaría y aprobación

Lista de pendientes con avisos de contexto: categoría que requiere confirmación, y si ya
fue socio, su número y su deuda congelada. Aprobar corre **una transacción, todo o nada**:
crea el socio con su número, la foto pasa a ser su perfil, y genera los tres cargos de
concepto `INGRESO`. Rechazar exige motivo.

### Task 6 — Pantalla de pago *(requiere credenciales y consentimiento)*

Un email con **un solo botón** que autentica y deja a la persona parada en el pago, con el
monto ya calculado. Del email al pago: dos clics.

### Task 7 — La orden con split *(requiere credenciales y consentimiento)*

Con `MercadoPagoOrdersAdapter.createSplitOrder` y `buildSplitEntriesFromDistribution` de
`@repo/payments`. La comisión sale de `getPlatformFeeBps`. **Se rechaza crear la orden si
`canReceiveSplit` es false**: MercadoPago la rechazaría igual, y fallar temprano da un
mensaje entendible en vez de un error del proveedor.

### Task 8 — Webhook y activación *(requiere credenciales y consentimiento)*

Con `parseMercadoPagoOrdersWebhook` y `mapMercadoPagoOrderStatus`. Idempotente por
identificador de proveedor con restricción única. Cubre los casos de la spec §8: webhook
duplicado, pago pendiente en efectivo —que **congela** el plazo de 30 días—, y contracargo,
que devuelve las cuotas a impagas sin expulsar a nadie.

Y una tarea programada que **concilia** los pagos pendientes contra MercadoPago, porque los
webhooks se pierden.

---

## Verificación final

- [ ] Toda la suite en verde
- [ ] `npx tsc --noEmit` sin errores nuevos
- [ ] `pnpm --filter fotoffice build` exit 0
- [ ] **El motor de Prisma queda rastreado** — sin esto, producción se cae:

```bash
cd apps/fotoffice && python3 -c "
import json,glob
f=glob.glob('.next/server/app/**/*.nft.json',recursive=True)[0]
d=json.load(open(f))
print('motor de linux:', any('rhel-openssl' in x for x in d.get('files',[])))"
```

- [ ] Verificar en un deployment antes de promover el alias
- [ ] A mano: solicitud → aprobación → email → pago → portal abierto

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cobrar sin consentimiento de split | `canReceiveSplit` se chequea antes de crear la orden |
| Doble cobro por webhook repetido | Restricción única por identificador de proveedor |
| Socios duplicados por aprobación simultánea | Transacción única + restricción `[workspaceId, memberNumber]` |
| Un cambio de build rompe producción | Verificar el rastreo del motor de Prisma y probar el deployment antes de promover |
| Cobrar dos veces los meses iniciales | Los cargos se guardan como registros reales desde el alta |
