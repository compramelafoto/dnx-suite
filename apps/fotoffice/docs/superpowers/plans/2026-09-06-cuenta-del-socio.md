# La cuenta del socio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la cuenta de un socio funcione en las dos direcciones —lo que debe y lo que tiene a favor— y que pueda pagar cuotas por adelantado.

**Architecture:** El saldo a favor no lleva tabla nueva: es **lo pagado menos lo imputado**, y `MembershipAllocation` ya permite imputar un pago a cargos creados después. Cada pieza se parte en una función pura (que se prueba sin base) y un envoltorio que toca Prisma, siguiendo el par `select-charges.ts` / `account.ts` que ya usa el módulo.

**Tech Stack:** Next.js (App Router, Server Components + Server Actions), Prisma sobre Postgres/Neon, Vitest, Tailwind con variables `--fo-*`.

**Spec:** `docs/superpowers/specs/2026-09-06-cuenta-del-socio-conciliacion-y-saldo-a-favor-design.md`

## Global Constraints

- **Cero cambios en `packages/db/prisma/schema.prisma`.** El schema es compartido por cinco bases Neon y cada columna hay que aplicarla a mano en las cinco.
- **Todo importe en centavos enteros.** La base guarda `Decimal(12,2)`; la conversión pasa por `decimalArsToMinor` / `minorToDecimalString` (`lib/membership/money.ts`), nunca por `Number` sobre un decimal.
- **Un pago histórico NUNCA cuenta como saldo a favor.** Los 231 pagos importados no tienen imputaciones a propósito; sin excluirlos aparecerían $2.213.288 de crédito falso. La exclusión vive en **una sola función**.
- **Español rioplatense** en todo texto visible y en los comentarios de código, siguiendo el tono del módulo.
- **Este plan NO incluye la conciliación del arrastre** (sección D de la especificación). Va en su propio plan porque depende de un reporte de pagos anterior a 10/2025 que todavía no existe.
- Correr las pruebas desde `apps/fotoffice` con `npx vitest run <ruta>`.

---

### Task 1: Qué parte de un pago sigue sin imputar

Es la pieza que contiene la trampa del cálculo. Todo lo demás depende de ella.

**Files:**
- Create: `apps/fotoffice/lib/membership/credit.ts`
- Test: `apps/fotoffice/lib/membership/credit.test.ts`

**Interfaces:**
- Consumes: `isHistoricalPayment(method: string | null): boolean` de `lib/membership/payment-method.ts`
- Produces:
  - `type PaymentForCredit = { id: string; method: string | null; providerPaymentRef: string | null; amountMinor: number; allocatedMinor: number }`
  - `type OpenCredit = { paymentId: string; remainingMinor: number }`
  - `creditFromPayments(payments: PaymentForCredit[]): { creditMinor: number; open: OpenCredit[] }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/fotoffice/lib/membership/credit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { creditFromPayments, type PaymentForCredit } from "./credit";
import { historicalMethod } from "./payment-method";

function pago(over: Partial<PaymentForCredit> = {}): PaymentForCredit {
  return {
    id: "p1",
    method: null,
    providerPaymentRef: null,
    amountMinor: 5000000,
    allocatedMinor: 5000000,
    ...over,
  };
}

describe("creditFromPayments", () => {
  it("un pago imputado por completo no deja crédito", () => {
    const r = creditFromPayments([pago()]);
    expect(r.creditMinor).toBe(0);
    expect(r.open).toEqual([]);
  });

  it("lo que sobró de un pago queda como crédito, con su pago identificado", () => {
    const r = creditFromPayments([pago({ amountMinor: 5000000, allocatedMinor: 800000 })]);
    expect(r.creditMinor).toBe(4200000);
    expect(r.open).toEqual([{ paymentId: "p1", remainingMinor: 4200000 }]);
  });

  it("suma el sobrante de varios pagos", () => {
    const r = creditFromPayments([
      pago({ id: "a", amountMinor: 1000000, allocatedMinor: 0 }),
      pago({ id: "b", amountMinor: 500000, allocatedMinor: 200000 }),
    ]);
    expect(r.creditMinor).toBe(1300000);
    expect(r.open.map((o) => o.paymentId)).toEqual(["a", "b"]);
  });

  it("UN PAGO HISTÓRICO NUNCA ES CRÉDITO, aunque no tenga ninguna imputación", () => {
    // Los 231 pagos importados del sistema anterior no imputan a propósito: son constancia
    // de un cobro, no un movimiento de cuenta. Sin esta regla darían $2.213.288 de crédito
    // que no existe.
    const r = creditFromPayments([
      pago({ id: "h", method: historicalMethod("EFECTIVO"), amountMinor: 4700000, allocatedMinor: 0 }),
    ]);
    expect(r.creditMinor).toBe(0);
    expect(r.open).toEqual([]);
  });

  it("también descarta el histórico reconocido por su referencia, no sólo por el medio", () => {
    const r = creditFromPayments([
      pago({ id: "h", providerPaymentRef: "HIST:ws:12:2024-03-10:500000", amountMinor: 500000, allocatedMinor: 0 }),
    ]);
    expect(r.creditMinor).toBe(0);
  });

  it("mezcla histórico y real sin contaminar el resultado", () => {
    const r = creditFromPayments([
      pago({ id: "h", method: historicalMethod("MERCADO_PAGO"), amountMinor: 4700000, allocatedMinor: 0 }),
      pago({ id: "r", amountMinor: 1600000, allocatedMinor: 800000 }),
    ]);
    expect(r.creditMinor).toBe(800000);
    expect(r.open).toEqual([{ paymentId: "r", remainingMinor: 800000 }]);
  });

  it("nunca devuelve crédito negativo si un pago figura imputado de más", () => {
    // No debería pasar, pero si pasa el socio no puede terminar debiendo por un redondeo.
    const r = creditFromPayments([pago({ amountMinor: 800000, allocatedMinor: 900000 })]);
    expect(r.creditMinor).toBe(0);
    expect(r.open).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/membership/credit.test.ts`
Expected: FAIL — `Failed to load url ./credit`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `apps/fotoffice/lib/membership/credit.ts`:

```ts
import { isHistoricalPayment } from "./payment-method";

/**
 * Cuánto de lo que pagó un socio todavía no se imputó a ningún cargo.
 *
 * `allocatePayment` ya declaraba que el sobrante «queda a favor del socio», pero no había
 * dónde guardarlo y el valor moría en un mensaje. No hace falta guardarlo: el sobrante **es
 * el pago mismo**, esperando cargos futuros, y `MembershipAllocation` permite imputar un pago
 * a cargos creados después.
 *
 * ── La trampa ──
 *
 * Los pagos históricos importados del sistema anterior **no tienen imputaciones a propósito**:
 * son constancia de un cobro, no un movimiento de cuenta. Con la fórmula de acá, sin
 * excluirlos, los 61 socios de la SFPR aparecerían con $2.213.288 de crédito que no existe.
 *
 * Por eso esta función es la **única puerta** al cálculo del saldo a favor. Ninguna pantalla
 * ni consulta puede calcularlo por su cuenta.
 *
 * Módulo PURO: sin base y sin red.
 */

export type PaymentForCredit = {
  id: string;
  method: string | null;
  providerPaymentRef: string | null;
  /** Importe del pago, en centavos. */
  amountMinor: number;
  /** Lo ya imputado a cargos, en centavos. */
  allocatedMinor: number;
};

export type OpenCredit = {
  paymentId: string;
  /** Lo que le queda a este pago por imputar, en centavos. */
  remainingMinor: number;
};

/** Marca de pago histórico en la referencia del proveedor. Ver `history-import/parse.ts`. */
const HISTORICAL_REF_PREFIX = "HIST:";

/**
 * ¿Este pago puede generar saldo a favor?
 *
 * Se mira el medio **y** la referencia. Un histórico siempre trae los dos, pero alcanzar con
 * cualquiera de ellos hace que un dato incompleto falle del lado seguro: no contar un crédito
 * que existe es un reclamo; contar uno que no existe es plata regalada.
 */
function cuentaParaCredito(p: PaymentForCredit): boolean {
  if (isHistoricalPayment(p.method)) return false;
  if (p.providerPaymentRef?.startsWith(HISTORICAL_REF_PREFIX)) return false;
  return true;
}

export function creditFromPayments(payments: PaymentForCredit[]): {
  creditMinor: number;
  open: OpenCredit[];
} {
  const open: OpenCredit[] = [];
  for (const p of payments) {
    if (!cuentaParaCredito(p)) continue;
    // `Math.max` y no una resta pelada: un pago que figure imputado de más no puede convertir
    // el crédito en deuda por la ventana de atrás.
    const restante = Math.max(0, p.amountMinor - p.allocatedMinor);
    if (restante > 0) open.push({ paymentId: p.id, remainingMinor: restante });
  }
  return { creditMinor: open.reduce((s, o) => s + o.remainingMinor, 0), open };
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/membership/credit.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/credit.ts apps/fotoffice/lib/membership/credit.test.ts
git commit -m "Lo que sobra de un pago es saldo a favor, y un histórico nunca lo es"
```

---

### Task 2: El saldo del socio, en las dos direcciones

**Files:**
- Create: `apps/fotoffice/lib/membership/balance.ts`
- Read for reference: `apps/fotoffice/lib/membership/account.ts`

**Interfaces:**
- Consumes: `creditFromPayments`, `OpenCredit`, `PaymentForCredit` (Task 1); `sortOldestFirst`, `OpenCharge` de `lib/membership/select-charges.ts`; `decimalArsToMinor` de `lib/membership/money.ts`
- Produces:
  - `type MemberBalance = { charges: OpenCharge[]; dueMinor: number; creditMinor: number; netMinor: number; openCredits: OpenCredit[]; overdueCount: number; oldestOverduePeriod: string | null }`
  - `loadMemberBalance(memberId: string, opciones?: { now?: Date }): Promise<MemberBalance>`

`netMinor` es `dueMinor - creditMinor`. Negativo significa que el socio está a favor.

- [ ] **Step 1: Escribir el módulo**

Crear `apps/fotoffice/lib/membership/balance.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { creditFromPayments, type OpenCredit, type PaymentForCredit } from "./credit";
import { decimalArsToMinor } from "./money";
import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * La cuenta de un socio, completa.
 *
 * Reemplaza a `loadMemberAccount`, que sólo sabía restar: leía cargos con saldo y nada más,
 * así que un socio que pagó de más no tenía dónde figurar.
 *
 * `netMinor` negativo significa que el socio está **a favor**.
 */

export type MemberBalance = {
  charges: OpenCharge[];
  /** Lo que debe, en centavos. */
  dueMinor: number;
  /** Lo que tiene a favor, en centavos. */
  creditMinor: number;
  /** `dueMinor - creditMinor`. Negativo = el socio está a favor. */
  netMinor: number;
  /** De qué pagos sale el crédito. Lo necesita la imputación automática. */
  openCredits: OpenCredit[];
  overdueCount: number;
  oldestOverduePeriod: string | null;
};

export async function loadMemberBalance(
  memberId: string,
  opciones: { now?: Date } = {},
): Promise<MemberBalance> {
  const ahora = opciones.now ?? new Date();

  const [cargos, pagos] = await Promise.all([
    prisma.membershipCharge.findMany({
      where: { memberId, balanceArs: { gt: 0 } },
      select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
    }),
    prisma.membershipPayment.findMany({
      where: { memberId, status: "ACREDITADO" },
      select: {
        id: true,
        method: true,
        providerPaymentRef: true,
        amountArs: true,
        allocations: { select: { principalArs: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const charges: OpenCharge[] = sortOldestFirst(
    cargos.map((f) => ({
      id: f.id,
      concept: String(f.concept),
      period: f.period,
      dueDate: f.dueDate,
      balanceMinor: decimalArsToMinor(f.balanceArs),
    })),
  );

  const paraCredito: PaymentForCredit[] = pagos.map((p) => ({
    id: p.id,
    method: p.method,
    providerPaymentRef: p.providerPaymentRef,
    amountMinor: decimalArsToMinor(p.amountArs),
    allocatedMinor: p.allocations.reduce((s, a) => s + decimalArsToMinor(a.principalArs), 0),
  }));

  const { creditMinor, open } = creditFromPayments(paraCredito);
  const dueMinor = charges.reduce((s, c) => s + c.balanceMinor, 0);
  const vencidas = charges.filter((c) => c.dueDate.getTime() < ahora.getTime());

  return {
    charges,
    dueMinor,
    creditMinor,
    netMinor: dueMinor - creditMinor,
    openCredits: open,
    overdueCount: vencidas.length,
    oldestOverduePeriod: vencidas[0]?.period ?? null,
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/lib/membership/balance.ts
git commit -m "La cuenta del socio también sabe sumar"
```

---

### Task 3: Imputar el crédito a los cargos abiertos

**Files:**
- Create: `apps/fotoffice/lib/membership/apply-credit.ts`
- Test: `apps/fotoffice/lib/membership/apply-credit.test.ts`

**Interfaces:**
- Consumes: `OpenCredit` (Task 1); `sortOldestFirst`, `OpenCharge` (`select-charges.ts`)
- Produces:
  - `type CreditApplication = { paymentId: string; chargeId: string; amountMinor: number; chargeRemainingMinor: number }`
  - `planCreditApplication(input: { credits: OpenCredit[]; charges: OpenCharge[] }): CreditApplication[]`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/fotoffice/lib/membership/apply-credit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planCreditApplication } from "./apply-credit";
import type { OpenCharge } from "./select-charges";

function cargo(period: string, balanceMinor: number, id = `c-${period}`): OpenCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    balanceMinor,
  };
}

describe("planCreditApplication", () => {
  it("sin crédito no imputa nada", () => {
    expect(planCreditApplication({ credits: [], charges: [cargo("2026-10", 800000)] })).toEqual([]);
  });

  it("sin cargos abiertos no imputa nada: el crédito espera", () => {
    expect(planCreditApplication({ credits: [{ paymentId: "p", remainingMinor: 800000 }], charges: [] }))
      .toEqual([]);
  });

  it("imputa el crédito al cargo y lo deja saldado", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 800000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "p", chargeId: "c-2026-10", amountMinor: 800000, chargeRemainingMinor: 0 },
    ]);
  });

  it("un crédito grande cubre varios cargos, del más viejo al más nuevo", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 2000000 }],
      charges: [cargo("2026-11", 800000), cargo("2026-10", 800000)],
    });
    expect(r.map((a) => a.chargeId)).toEqual(["c-2026-10", "c-2026-11"]);
    expect(r.every((a) => a.chargeRemainingMinor === 0)).toBe(true);
  });

  it("un crédito que no alcanza deja el cargo parcialmente pago", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 300000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "p", chargeId: "c-2026-10", amountMinor: 300000, chargeRemainingMinor: 500000 },
    ]);
  });

  it("varios créditos se consumen del más viejo al más nuevo", () => {
    const r = planCreditApplication({
      credits: [
        { paymentId: "viejo", remainingMinor: 500000 },
        { paymentId: "nuevo", remainingMinor: 900000 },
      ],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "viejo", chargeId: "c-2026-10", amountMinor: 500000, chargeRemainingMinor: 300000 },
      { paymentId: "nuevo", chargeId: "c-2026-10", amountMinor: 300000, chargeRemainingMinor: 0 },
    ]);
  });

  it("no imputa más de lo que hay: cada centavo del crédito o se usa o queda", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 2000000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r.reduce((s, a) => s + a.amountMinor, 0)).toBe(800000);
  });

  it("ignora cargos ya saldados", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 800000 }],
      charges: [cargo("2026-09", 0), cargo("2026-10", 800000)],
    });
    expect(r.map((a) => a.chargeId)).toEqual(["c-2026-10"]);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/membership/apply-credit.test.ts`
Expected: FAIL — `Failed to load url ./apply-credit`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `apps/fotoffice/lib/membership/apply-credit.ts`:

```ts
import type { OpenCredit } from "./credit";
import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * Cómo se consume el saldo a favor cuando aparecen cargos nuevos.
 *
 * Es lo que hacía el sistema anterior de la SFPR y FotoOffice no: el socio 617 transfirió de
 * más y se le fue descontando mes a mes. Sin esto, el mes siguiente se le cobra la cuota
 * completa como si no hubiera adelantado nada.
 *
 * Del cargo más viejo al más nuevo, igual que `selectChargesToPay`: dejar una cuota vieja
 * impaga y saldar la nueva ensucia el cálculo de mora.
 *
 * Módulo PURO: decide plata, así que tiene que poder probarse hasta el borde.
 */

export type CreditApplication = {
  paymentId: string;
  chargeId: string;
  /** Cuánto de ese pago se imputa a ese cargo, en centavos. */
  amountMinor: number;
  /** Lo que le queda al cargo después de esta imputación, en centavos. */
  chargeRemainingMinor: number;
};

export function planCreditApplication(input: {
  /** En el orden en que se van a consumir: el pago más viejo primero. */
  credits: OpenCredit[];
  charges: OpenCharge[];
}): CreditApplication[] {
  const disponibles = input.credits
    .map((c) => ({ ...c }))
    .filter((c) => c.remainingMinor > 0);
  const cargos = sortOldestFirst(input.charges.filter((c) => c.balanceMinor > 0));

  const salida: CreditApplication[] = [];

  for (const cargo of cargos) {
    let pendiente = cargo.balanceMinor;
    for (const credito of disponibles) {
      if (pendiente <= 0) break;
      if (credito.remainingMinor <= 0) continue;
      const usado = Math.min(pendiente, credito.remainingMinor);
      pendiente -= usado;
      credito.remainingMinor -= usado;
      salida.push({
        paymentId: credito.paymentId,
        chargeId: cargo.id,
        amountMinor: usado,
        chargeRemainingMinor: pendiente,
      });
    }
  }

  return salida;
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/membership/apply-credit.test.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/apply-credit.ts apps/fotoffice/lib/membership/apply-credit.test.ts
git commit -m "Plan de imputación del saldo a favor contra los cargos abiertos"
```

---

### Task 4: Escribir la imputación, y engancharla a la generación mensual

**Files:**
- Create: `apps/fotoffice/lib/membership/apply-credit-store.ts`
- Modify: `apps/fotoffice/lib/membership/generate-monthly.ts` (después del bucle de creación de cargos, antes del `return`)

**Interfaces:**
- Consumes: `loadMemberBalance` (Task 2), `planCreditApplication` (Task 3), `minorToDecimalString` (`money.ts`)
- Produces:
  - `applyCreditForMember(memberId: string): Promise<{ appliedMinor: number; chargesTouched: number }>`
  - `applyCreditForWorkspace(workspaceId: string): Promise<{ membersTouched: number; appliedMinor: number }>`

- [ ] **Step 1: Escribir el módulo de escritura**

Crear `apps/fotoffice/lib/membership/apply-credit-store.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { loadMemberBalance } from "./balance";
import { planCreditApplication } from "./apply-credit";
import { decimalArsToMinor, minorToDecimalString } from "./money";

/**
 * Consume el saldo a favor del socio contra sus cargos abiertos.
 *
 * **Idempotente.** El crédito se relee de la base en cada corrida, así que una segunda
 * ejecución no encuentra nada que imputar. La imputación usa `upsert` porque un pago puede
 * llegar a un cargo en dos tandas —la clave `[paymentId, chargeId]` es única— y en ese caso
 * corresponde sumar, no fallar.
 *
 * Todo en una transacción: un cargo bajado sin su imputación dejaría plata sin rastro.
 */
export async function applyCreditForMember(
  memberId: string,
): Promise<{ appliedMinor: number; chargesTouched: number }> {
  const saldo = await loadMemberBalance(memberId);
  if (saldo.creditMinor <= 0 || saldo.charges.length === 0) {
    return { appliedMinor: 0, chargesTouched: 0 };
  }

  const plan = planCreditApplication({ credits: saldo.openCredits, charges: saldo.charges });
  if (plan.length === 0) return { appliedMinor: 0, chargesTouched: 0 };

  await prisma.$transaction(async (tx) => {
    for (const im of plan) {
      // Se lee lo ya imputado y se escribe el total, en vez de un `increment`: incrementar
      // un `Decimal` con un string es un tipo que Prisma no garantiza, y acá se suma plata.
      // Estar dentro de la transacción hace que leer y escribir no se puedan separar.
      const previa = await tx.membershipAllocation.findUnique({
        where: { paymentId_chargeId: { paymentId: im.paymentId, chargeId: im.chargeId } },
        select: { principalArs: true },
      });
      const totalMinor = (previa ? decimalArsToMinor(previa.principalArs) : 0) + im.amountMinor;

      await tx.membershipAllocation.upsert({
        where: { paymentId_chargeId: { paymentId: im.paymentId, chargeId: im.chargeId } },
        create: {
          paymentId: im.paymentId,
          chargeId: im.chargeId,
          principalArs: minorToDecimalString(im.amountMinor),
        },
        update: { principalArs: minorToDecimalString(totalMinor) },
      });
      await tx.membershipCharge.update({
        where: { id: im.chargeId },
        data: { balanceArs: minorToDecimalString(im.chargeRemainingMinor) },
      });
    }
  });

  return {
    appliedMinor: plan.reduce((s, a) => s + a.amountMinor, 0),
    chargesTouched: new Set(plan.map((a) => a.chargeId)).size,
  };
}

/**
 * Lo mismo para toda la institución. Se corre después de generar las cuotas del mes: el socio
 * que tenía crédito no puede recibir un reclamo por una cuota que su saldo ya cubre.
 *
 * De a uno y no en una transacción gigante, igual que la generación: si falla el socio 100,
 * los 99 anteriores ya quedaron bien y volver a correrlo no los toca.
 */
export async function applyCreditForWorkspace(
  workspaceId: string,
): Promise<{ membersTouched: number; appliedMinor: number }> {
  const socios = await prisma.member.findMany({
    where: { workspaceId, payments: { some: { status: "ACREDITADO" } } },
    select: { id: true },
  });

  let membersTouched = 0;
  let appliedMinor = 0;
  for (const s of socios) {
    const r = await applyCreditForMember(s.id);
    if (r.appliedMinor > 0) {
      membersTouched += 1;
      appliedMinor += r.appliedMinor;
    }
  }
  return { membersTouched, appliedMinor };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si `payments` no es el nombre de la relación inversa en `Member`, buscarlo con `grep -n "MembershipPayment\[\]" packages/db/prisma/schema.prisma` y usar el nombre real.

- [ ] **Step 3: Engancharlo a la generación mensual**

En `apps/fotoffice/lib/membership/generate-monthly.ts`, agregar el import arriba:

```ts
import { applyCreditForWorkspace } from "./apply-credit-store";
```

y justo antes del `return { period: input.period, creadas, ... }` final:

```ts
  // El socio que tenía saldo a favor no puede recibir un reclamo por una cuota que su
  // crédito ya cubre. Se corre después de crear los cargos, sobre los cargos recién creados.
  await applyCreditForWorkspace(input.workspaceId);
```

- [ ] **Step 4: Verificar que no rompió nada**

Run: `npx vitest run lib/membership && npx tsc --noEmit -p tsconfig.json`
Expected: todo pasa.

- [ ] **Step 5: Verificar la idempotencia contra la base real**

La especificación pide que correrlo dos veces no impute dos veces. Es una propiedad de la
escritura, no de la función pura, así que se comprueba contra la base — el mismo método con
el que se verificó la importación de pagos históricos.

Crear `scratchpad/verificar-credito.ts` (archivo descartable, NO se comitea):

```ts
import { prisma } from "@repo/db";
import { applyCreditForMember } from "@/lib/membership/apply-credit-store";

async function main() {
  const memberId = process.argv[2]!;
  console.log("1ra corrida:", await applyCreditForMember(memberId));
  console.log("2da corrida:", await applyCreditForMember(memberId));
  const imputado = await prisma.membershipAllocation.aggregate({
    where: { payment: { memberId } },
    _sum: { principalArs: true },
  });
  console.log("total imputado:", imputado._sum.principalArs?.toString());
  await prisma.$disconnect();
}
main();
```

Run, sobre un socio de prueba con crédito:
`set -a; . ./.env.local; set +a; NODE_OPTIONS="--conditions=react-server" npx tsx scratchpad/verificar-credito.ts <memberId>`

Expected: la 2da corrida devuelve `appliedMinor: 0`, y el total imputado es el mismo después
de las dos. Borrar el archivo al terminar.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/membership/apply-credit-store.ts apps/fotoffice/lib/membership/generate-monthly.ts
git commit -m "El saldo a favor se descuenta solo de las cuotas nuevas"
```

---

### Task 5: Que el socio y la Secretaría vean el saldo a favor

Las dos pantallas se migran juntas: dejar una con la vista vieja haría que el socio y la Secretaría vieran cuentas distintas, que es justo lo que un reclamo no debe encontrar.

**Files:**
- Create: `apps/fotoffice/components/membership/credit-callout.tsx`
- Modify: `apps/fotoffice/app/portal/cuotas/page.tsx`
- Modify: `apps/fotoffice/app/(shell)/members/[id]/page.tsx`

**Interfaces:**
- Consumes: `loadMemberBalance` (Task 2), `formatMinorArs` (`money.ts`)
- Produces: `<CreditCallout creditMinor={number} tone="socio" | "panel" />`

- [ ] **Step 1: Escribir el componente**

Crear `apps/fotoffice/components/membership/credit-callout.tsx`:

```tsx
import { formatMinorArs } from "@/lib/membership/money";

/**
 * El saldo a favor del socio.
 *
 * Se le habla distinto a cada uno: al socio se le dice qué va a pasar con esa plata, a la
 * Secretaría se le dice qué tiene que esperar del próximo cierre. El mismo número contado dos
 * veces igual sería una de las dos explicaciones sobrando.
 */
export function CreditCallout({
  creditMinor,
  tone,
}: {
  creditMinor: number;
  tone: "socio" | "panel";
}) {
  if (creditMinor <= 0) return null;

  return (
    <section className="fo-card space-y-2 border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] p-5">
      <h2 className="text-sm font-semibold text-[var(--fo-success)]">
        {tone === "socio" ? "Tenés saldo a favor" : "Saldo a favor"}
      </h2>
      <p className="text-2xl font-semibold tabular-nums">{formatMinorArs(creditMinor)}</p>
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        {tone === "socio"
          ? "Se va a descontar solo de tus próximas cuotas. No hace falta que hagas nada."
          : "Se imputa solo a las cuotas que se generen. No aparece como deuda ni como cobro nuevo."}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Migrar la pantalla del socio**

En `apps/fotoffice/app/portal/cuotas/page.tsx`:

Cambiar el import `import { loadMemberAccount } from "@/lib/membership/account";` por:

```ts
import { loadMemberBalance } from "@/lib/membership/balance";
import { CreditCallout } from "@/components/membership/credit-callout";
```

Cambiar `loadMemberAccount(context.member.id)` por `loadMemberBalance(context.member.id)` en el `Promise.all`, y renombrar la variable `account` a `cuenta`.

Reemplazar `const alDia = account.charges.length === 0;` por:

```ts
  // Estar al día ahora incluye al que está a favor: reclamarle algo a quien adelantó cuotas
  // sería el peor mensaje posible.
  const alDia = cuenta.charges.length === 0;
```

Reemplazar cada `account.totalDueMinor` por `cuenta.dueMinor` y cada `account.charges` por `cuenta.charges`.

Insertar el bloque de crédito **antes** de la sección "Lo que pagaste" y fuera del condicional `alDia`:

```tsx
        <CreditCallout creditMinor={cuenta.creditMinor} tone="socio" />
```

- [ ] **Step 3: Agregar el saldo a la ficha del panel**

En `apps/fotoffice/app/(shell)/members/[id]/page.tsx`, junto a la carga de `pagos`:

```ts
  const cuenta = puedeCobrar ? await loadMemberBalance(member.id) : null;
```

con el import:

```ts
import { loadMemberBalance } from "@/lib/membership/balance";
import { CreditCallout } from "@/components/membership/credit-callout";
```

y dentro del bloque `{puedeCobrar ? (...)}` de "Pagos", arriba de `<PaymentHistoryList ...>`:

```tsx
              {cuenta ? <CreditCallout creditMinor={cuenta.creditMinor} tone="panel" /> : null}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint app/portal/cuotas/page.tsx "app/(shell)/members/[id]/page.tsx" components/membership/credit-callout.tsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/components/membership/credit-callout.tsx apps/fotoffice/app/portal/cuotas/page.tsx "apps/fotoffice/app/(shell)/members/[id]/page.tsx"
git commit -m "El saldo a favor se ve, del lado del socio y del lado del mostrador"
```

---

### Task 6: Qué meses se pueden adelantar

**Files:**
- Create: `apps/fotoffice/lib/membership/advance.ts`
- Test: `apps/fotoffice/lib/membership/advance.test.ts`

**Interfaces:**
- Consumes: `periodOf` de `lib/membership/monthly-plan.ts`
- Produces:
  - `const MAX_ADVANCE_MONTHS = 6`
  - `type AdvancePeriod = { period: string; amountMinor: number; dueDate: Date }`
  - `planAdvancePeriods(input: { fromPeriod: string; months: number; feeValueMinor: number; dueDay: number }): AdvancePeriod[]`

`fromPeriod` es el primer mes a adelantar, en `AAAA-MM`. El tope de 6 meses está en el código y no en la base a propósito: es una decisión de riesgo, no una preferencia por institución.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/fotoffice/lib/membership/advance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_ADVANCE_MONTHS, planAdvancePeriods } from "./advance";

const BASE = { fromPeriod: "2026-10", feeValueMinor: 800000, dueDay: 10 };

describe("planAdvancePeriods", () => {
  it("un mes adelantado es un solo período, al valor vigente", () => {
    expect(planAdvancePeriods({ ...BASE, months: 1 })).toEqual([
      { period: "2026-10", amountMinor: 800000, dueDate: new Date(Date.UTC(2026, 9, 10)) },
    ]);
  });

  it("varios meses son meses consecutivos", () => {
    const r = planAdvancePeriods({ ...BASE, months: 3 });
    expect(r.map((p) => p.period)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("cruza el año sin inventar un mes 13", () => {
    const r = planAdvancePeriods({ ...BASE, fromPeriod: "2026-11", months: 3 });
    expect(r.map((p) => p.period)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("no deja adelantar más que el tope", () => {
    expect(planAdvancePeriods({ ...BASE, months: 99 })).toHaveLength(MAX_ADVANCE_MONTHS);
  });

  it("un pedido de cero o negativo no devuelve nada", () => {
    expect(planAdvancePeriods({ ...BASE, months: 0 })).toEqual([]);
    expect(planAdvancePeriods({ ...BASE, months: -3 })).toEqual([]);
  });

  it("sin valor de cuota no se ofrece nada: no se cobra un precio que no está fijado", () => {
    expect(planAdvancePeriods({ ...BASE, months: 3, feeValueMinor: 0 })).toEqual([]);
  });

  it("un mes con menos días no corre el vencimiento al mes siguiente", () => {
    // Día 31 en febrero: se topea, nunca se desborda.
    const r = planAdvancePeriods({ fromPeriod: "2027-02", months: 1, feeValueMinor: 800000, dueDay: 31 });
    expect(r[0]?.dueDate).toEqual(new Date(Date.UTC(2027, 1, 28)));
  });

  it("un período mal formado no devuelve nada en vez de inventar una fecha", () => {
    expect(planAdvancePeriods({ ...BASE, fromPeriod: "octubre", months: 2 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/membership/advance.test.ts`
Expected: FAIL — `Failed to load url ./advance`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `apps/fotoffice/lib/membership/advance.ts`:

```ts
/**
 * Qué meses puede adelantar un socio, y a qué precio.
 *
 * El socio elige **cuántos meses**, no un importe. Cobrar un importe libre es lo que dejaba
 * sobrantes flotando; adelantar cuotas es una operación con precio conocido de las dos partes.
 *
 * ── Por qué hay un tope ──
 *
 * Adelantar congela el precio: quien paga doce meses antes de un aumento los paga al valor
 * viejo. Seis es el límite hasta que la institución decida otra cosa, y vive en el código y
 * no en la configuración a propósito — es una decisión de riesgo económico, no una preferencia
 * de cada institución.
 *
 * Módulo PURO.
 */

export const MAX_ADVANCE_MONTHS = 6;

export type AdvancePeriod = {
  /** `AAAA-MM`. */
  period: string;
  amountMinor: number;
  dueDate: Date;
};

const PERIOD_RE = /^\d{4}-\d{2}$/;

export function planAdvancePeriods(input: {
  /** Primer mes a adelantar, `AAAA-MM`. */
  fromPeriod: string;
  months: number;
  /** Valor de la cuota vigente, en centavos. Cero significa que no hay valor fijado. */
  feeValueMinor: number;
  dueDay: number;
}): AdvancePeriod[] {
  if (!PERIOD_RE.test(input.fromPeriod)) return [];
  if (!Number.isInteger(input.months) || input.months < 1) return [];
  if (input.feeValueMinor <= 0) return [];

  const [anio, mes] = input.fromPeriod.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return [];

  const cuantos = Math.min(input.months, MAX_ADVANCE_MONTHS);
  const salida: AdvancePeriod[] = [];

  for (let i = 0; i < cuantos; i += 1) {
    const fecha = new Date(Date.UTC(anio, mes - 1 + i, 1));
    const a = fecha.getUTCFullYear();
    const m = fecha.getUTCMonth() + 1;
    // Último día real del mes: un vencimiento el 31 de febrero se desbordaría a marzo.
    const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
    salida.push({
      period: `${a}-${String(m).padStart(2, "0")}`,
      amountMinor: input.feeValueMinor,
      dueDate: new Date(Date.UTC(a, m - 1, Math.min(input.dueDay, ultimoDia))),
    });
  }

  return salida;
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/membership/advance.test.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/advance.ts apps/fotoffice/lib/membership/advance.test.ts
git commit -m "Qué meses se pueden adelantar, y hasta dónde"
```

---

### Task 7: Adelantar cuotas desde el portal

**Files:**
- Create: `apps/fotoffice/lib/membership/advance-store.ts`
- Create: `apps/fotoffice/app/portal/cuotas/advance-form.tsx`
- Modify: `apps/fotoffice/app/portal/cuotas/page.tsx`

**Interfaces:**
- Consumes: `planAdvancePeriods`, `MAX_ADVANCE_MONTHS` (Task 6); `loadMemberBalance` (Task 2); `getActiveFeeValue` de `lib/membership/settings.ts`; `getDuesSettings` de `lib/membership/settings.ts`; `periodOf` de `lib/membership/monthly-plan.ts`; `decimalArsToMinor`, `minorToDecimalString`, `formatMinorArs` de `money.ts`
- Produces:
  - `loadAdvanceOffer(memberId: string, opciones?: { now?: Date }): Promise<{ periods: AdvancePeriod[]; feeValueMinor: number }>`
  - `createAdvanceCharges(input: { memberId: string; months: number }): Promise<{ ok: true; chargeIds: string[]; totalMinor: number } | { ok: false; error: string }>`

- [ ] **Step 1: Escribir el módulo de oferta y creación**

Crear `apps/fotoffice/lib/membership/advance-store.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { MAX_ADVANCE_MONTHS, planAdvancePeriods, type AdvancePeriod } from "./advance";
import { getActiveFeeValue, getDuesSettings } from "./settings";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import { periodOf } from "./monthly-plan";

/**
 * Adelantar cuotas.
 *
 * Los cargos adelantados se crean **al pedirlos** y se pagan por el circuito normal: no hay
 * un cobro aparte ni un estado nuevo. La cuota de diciembre pagada en octubre es la cuota de
 * diciembre, y cuando llegue diciembre la generación mensual la va a encontrar hecha y no la
 * va a duplicar — la clave `[memberId, concept, period]` ya es única.
 */

/** Desde qué mes se puede adelantar: el primero que el socio todavía no tiene cargado. */
async function primerMesLibre(memberId: string, ahora: Date): Promise<string> {
  const ultimo = await prisma.membershipCharge.findFirst({
    where: { memberId, concept: "MENSUAL" },
    orderBy: { period: "desc" },
    select: { period: true },
  });
  const base = ultimo?.period ?? periodOf(ahora);
  const [a, m] = base.split("-").map(Number);
  const siguiente = new Date(Date.UTC(a ?? 1970, (m ?? 1), 1));
  return periodOf(siguiente);
}

export async function loadAdvanceOffer(
  memberId: string,
  opciones: { now?: Date } = {},
): Promise<{ periods: AdvancePeriod[]; feeValueMinor: number }> {
  const ahora = opciones.now ?? new Date();
  const socio = await prisma.member.findUnique({
    where: { id: memberId },
    select: { workspaceId: true, categoryId: true },
  });
  if (!socio) return { periods: [], feeValueMinor: 0 };

  const [settings, valor, desde] = await Promise.all([
    getDuesSettings(socio.workspaceId),
    getActiveFeeValue(socio.workspaceId, socio.categoryId, ahora),
    primerMesLibre(memberId, ahora),
  ]);

  const feeValueMinor = valor ? decimalArsToMinor(valor.amountArs) : 0;
  return {
    periods: planAdvancePeriods({
      fromPeriod: desde,
      // Se ofrece el tope completo; cuántos toma de verdad lo elige el socio en la pantalla.
      months: MAX_ADVANCE_MONTHS,
      feeValueMinor,
      dueDay: settings.dueDay,
    }),
    feeValueMinor,
  };
}

export async function createAdvanceCharges(input: {
  memberId: string;
  months: number;
}): Promise<{ ok: true; chargeIds: string[]; totalMinor: number } | { ok: false; error: string }> {
  const socio = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { workspaceId: true, categoryId: true },
  });
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };

  const oferta = await loadAdvanceOffer(input.memberId);
  if (oferta.feeValueMinor <= 0) {
    return { ok: false, error: "La institución todavía no fijó el valor de la cuota." };
  }
  const elegidos = oferta.periods.slice(0, Math.max(0, input.months));
  if (elegidos.length === 0) {
    return { ok: false, error: "Elegí cuántos meses querés adelantar." };
  }

  const chargeIds: string[] = [];
  for (const p of elegidos) {
    const creado = await prisma.membershipCharge.upsert({
      where: {
        memberId_concept_period: { memberId: input.memberId, concept: "MENSUAL", period: p.period },
      },
      create: {
        workspaceId: socio.workspaceId,
        memberId: input.memberId,
        concept: "MENSUAL",
        period: p.period,
        amountArs: minorToDecimalString(p.amountMinor),
        balanceArs: minorToDecimalString(p.amountMinor),
        dueDate: p.dueDate,
      },
      // Ya existía: no se le toca el importe ni el saldo. Adelantar no puede reescribir una
      // cuota que la institución ya generó ni resucitar una ya pagada.
      update: {},
      select: { id: true },
    });
    chargeIds.push(creado.id);
  }

  return {
    ok: true,
    chargeIds,
    totalMinor: elegidos.reduce((s, p) => s + p.amountMinor, 0),
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si el nombre del índice único compuesto no es `memberId_concept_period`, buscarlo con `grep -n "@@unique(\[memberId, concept, period\])" packages/db/prisma/schema.prisma` y usar el que genere Prisma.

- [ ] **Step 3: Escribir la acción y el formulario**

Crear `apps/fotoffice/app/portal/cuotas/advance-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceDuesAction } from "@/app/actions/advance-dues";

/**
 * Adelantar cuotas.
 *
 * Se elige cuántos meses, no un importe: el socio ve exactamente qué está comprando y a qué
 * precio antes de confirmar. Pedirle un monto libre es lo que dejaba sobrantes flotando.
 */
export function AdvanceForm({
  options,
}: {
  options: { months: number; label: string; totalLabel: string }[];
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (options.length === 0) return null;

  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-sm font-semibold">Adelantar cuotas</h2>
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        Pagás los meses que elijas al valor de hoy. Si la cuota sube después, los que
        adelantaste ya quedaron pagos.
      </p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.months}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-3 text-sm hover:border-[var(--fo-accent)]">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="months"
                  checked={elegido === o.months}
                  onChange={() => setElegido(o.months)}
                />
                {o.label}
              </span>
              <span className="font-medium tabular-nums">{o.totalLabel}</span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="fo-btn fo-btn-primary w-full text-sm disabled:opacity-60"
        disabled={pendiente || elegido === null}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await advanceDuesAction(elegido ?? 0);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            router.push(r.payPath);
          })
        }
      >
        {pendiente ? "Preparando el pago…" : "Adelantar y pagar"}
      </button>
    </section>
  );
}
```

Crear `apps/fotoffice/app/actions/advance-dues.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { createAdvanceCharges } from "@/lib/membership/advance-store";

export type AdvanceDuesResult =
  | { ok: true; payPath: string }
  | { ok: false; error: string };

/**
 * Crea los cargos adelantados y devuelve a dónde ir a pagarlos.
 *
 * No cobra acá: los cargos entran al circuito normal de cuotas y se pagan con el mismo botón
 * que el resto. Un cobro aparte sería una segunda forma de pagar una cuota, y dos caminos
 * para lo mismo terminan divergiendo.
 */
export async function advanceDuesAction(months: number): Promise<AdvanceDuesResult> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { ok: false, error: "No encontramos tu ficha de socio." };

  const r = await createAdvanceCharges({ memberId: context.member.id, months });
  if (!r.ok) return r;

  revalidatePath("/portal/cuotas");
  return { ok: true, payPath: "/portal/cuotas" };
}
```

- [ ] **Step 4: Mostrar el formulario en la pantalla del socio**

En `apps/fotoffice/app/portal/cuotas/page.tsx`, agregar a los imports:

```ts
import { loadAdvanceOffer } from "@/lib/membership/advance-store";
import { AdvanceForm } from "./advance-form";
import { formatMinorArs } from "@/lib/membership/money";
```

sumar `loadAdvanceOffer(context.member.id)` al `Promise.all` como `oferta`, y armar las opciones:

```ts
  // Se ofrece 1, 3 y 6: una lista de seis opciones es una decisión que nadie quiere tomar.
  const opcionesAdelanto = [1, 3, 6]
    .filter((n) => n <= oferta.periods.length)
    .map((n) => ({
      months: n,
      label: n === 1 ? "1 mes" : `${n} meses`,
      totalLabel: formatMinorArs(oferta.periods.slice(0, n).reduce((s, p) => s + p.amountMinor, 0)),
    }));
```

y renderizar, debajo de la sección de pago y sólo si hay cobro en línea habilitado:

```tsx
        {cobros.canCharge ? <AdvanceForm options={opcionesAdelanto} /> : null}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run lib/membership && npx eslint app/portal/cuotas app/actions/advance-dues.ts lib/membership`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/membership/advance-store.ts apps/fotoffice/app/portal/cuotas apps/fotoffice/app/actions/advance-dues.ts
git commit -m "El socio puede adelantar cuotas eligiendo meses, no importes"
```

---

### Task 8: Retirar `loadMemberAccount`

**Files:**
- Modify: `apps/fotoffice/app/actions/dues-payment.ts`
- Delete: `apps/fotoffice/lib/membership/account.ts`

Dejar las dos versiones conviviendo es la forma más segura de que dentro de tres meses alguien lea la vieja y no entienda por qué al socio le falta plata.

- [ ] **Step 1: Buscar todos los llamadores**

Run: `grep -rn "loadMemberAccount" apps/fotoffice --include="*.ts" --include="*.tsx"`
Expected: `app/actions/dues-payment.ts` y `lib/membership/account.ts`. Si aparece alguno más, migrarlo también.

- [ ] **Step 2: Migrar `dues-payment.ts`**

Cambiar el import de `loadMemberAccount` por `loadMemberBalance` de `@/lib/membership/balance`, cambiar la llamada, y reemplazar `account.charges` por `cuenta.charges`.

- [ ] **Step 3: Borrar el módulo viejo**

```bash
rm apps/fotoffice/lib/membership/account.ts
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run && npx next build --webpack`
Expected: tipos sin errores; la única prueba que falla es `lib/template-v2/access.test.ts`, que ya fallaba antes de este plan (busca la pantalla del diseñador en `app/(shell)/` cuando vive en `app/(editor)/`); build correcto.

- [ ] **Step 5: Commit**

```bash
git add -A apps/fotoffice
git commit -m "Retirar la cuenta que sólo sabía restar"
```
