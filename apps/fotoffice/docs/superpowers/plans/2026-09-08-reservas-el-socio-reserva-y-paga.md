# Reservas — el socio reserva y paga

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el socio reserve un espacio desde el portal —con sus extras y sus horas bonificadas— y lo pague por Mercado Pago o por transferencia, con la comisión del 5% resuelta como ya se resuelve en las cuotas.

**Architecture:** Todo lo difícil ya existe: el motor de disponibilidad, el precio, los extras y la creación con doble defensa contra el solapamiento. Este plan agrega la bolsa mensual de horas bonificadas, engancha el cobro al circuito de Checkout Pro que ya usan las cuotas, y pone las pantallas del socio y del público. No inventa ningún circuito de pago nuevo.

**Tech Stack:** Next.js 16 (App Router, Server Components y Server Actions), Prisma sobre Postgres (Neon), Mercado Pago Checkout Pro con `marketplace_fee`, vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-07-reservas-e-integraciones-design.md` (Parte 2)

**Plan anterior:** `docs/superpowers/plans/2026-09-07-reservas-nucleo.md`, ya implementado. Este plan asume que existen `lib/bookings/{time,availability,pricing,conflicts,extras,repository,create,constants}.ts` y las diez tablas.

## Global Constraints

- **Directorio de trabajo:** `apps/fotoffice`. Rutas relativas a ahí, salvo `packages/db/prisma/schema.prisma`.
- **Tests:** `pnpm test`. Solo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`.
- **Dinero en centavos y con enteros.** Nunca coma flotante. `decimalArsToMinor` / `minorToDecimalString` / `formatMinorArs` de `lib/membership/money.ts`.
- **Tiempo:** UTC en la base, `America/Argentina/Buenos_Aires` para mostrar e interpretar. Nunca `new Date(texto)` sobre un `datetime-local`: va `parseLocalDateTime` de `lib/bookings/local-datetime.ts`.
- **Estilos:** clases del design system (`fo-card`, `fo-btn`, `fo-input`, `fo-label`, `fo-helper`, `fo-field-stack`, `fo-form-actions`) y variables `--fo-*`. Nunca colores crudos de Tailwind.
- **Permisos:** el portal exige sesión de socio (`loadPortalContext`); la agenda y la aprobación son STAFF+/ADMIN+ vía `lib/bookings/access.ts`. Siempre en el servidor.
- **La comisión se calcula sobre lo efectivamente cobrado**, nunca sobre el precio de lista.
- **Idioma:** comentarios, errores y pantallas en castellano rioplatense.
- **Commits:** una oración que dice qué queda funcionando. Firma:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

---

### Task 1: La bolsa de horas bonificadas del mes

Cuántos minutos bonificados le quedan al socio en un espacio, este mes. No se acumulan, y por eso no hace falta ninguna tabla: se cuentan las reservas del mes.

**Files:**
- Create: `lib/bookings/free-hours.ts`
- Test: `lib/bookings/free-hours.test.ts`

**Interfaces:**
- Consumes: `monthKeyOf`, `BOOKINGS_TIME_ZONE` (`lib/bookings/time.ts`); `ACTIVE_BOOKING_STATUSES` (`lib/bookings/constants.ts`).
- Produces:
  - `type FreeHoursBalance = { grantedMinutes: number; usedMinutes: number; availableMinutes: number; monthKey: string }`
  - `computeFreeHoursBalance(input: { grantedHoursPerMonth: number; usedMinutes: number; monthKey: string }): FreeHoursBalance` — puro
  - `monthBoundsFor(at: Date, timeZone: string): { startAt: Date; endAt: Date }` — el mes calendario local, en instantes
  - `loadFreeMinutesAvailable(input: { workspaceId: string; memberId: string; spaceId: string; grantedHoursPerMonth: number; at?: Date }): Promise<FreeHoursBalance>` — consulta la base

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/free-hours.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { computeFreeHoursBalance, monthBoundsFor } from "./free-hours";

const tz = BOOKINGS_TIME_ZONE;

describe("la bolsa del mes", () => {
  it("sin nada usado, están las horas completas", () => {
    const b = computeFreeHoursBalance({ grantedHoursPerMonth: 2, usedMinutes: 0, monthKey: "2026-09" });
    expect(b.grantedMinutes).toBe(120);
    expect(b.availableMinutes).toBe(120);
  });

  it("lo usado se descuenta", () => {
    const b = computeFreeHoursBalance({ grantedHoursPerMonth: 2, usedMinutes: 60, monthKey: "2026-09" });
    expect(b.availableMinutes).toBe(60);
  });

  it("un espacio que no bonifica no da nada", () => {
    const b = computeFreeHoursBalance({ grantedHoursPerMonth: 0, usedMinutes: 0, monthKey: "2026-09" });
    expect(b.availableMinutes).toBe(0);
  });

  it("nunca queda negativa, aunque se haya usado de más", () => {
    // Puede pasar si el dueño baja las horas bonificadas con reservas ya hechas.
    const b = computeFreeHoursBalance({ grantedHoursPerMonth: 1, usedMinutes: 300, monthKey: "2026-09" });
    expect(b.availableMinutes).toBe(0);
  });

  it("un valor absurdo se trata como cero, no rompe el precio", () => {
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: Number.NaN,
      usedMinutes: -50,
      monthKey: "2026-09",
    });
    expect(b.grantedMinutes).toBe(0);
    expect(b.usedMinutes).toBe(0);
    expect(b.availableMinutes).toBe(0);
  });
});

describe("los bordes del mes", () => {
  it("son la medianoche local del 1 y la del 1 siguiente", () => {
    const b = monthBoundsFor(new Date("2026-09-19T17:00:00Z"), tz);
    // Medianoche del 1/9 en Rosario = 03:00Z.
    expect(b.startAt.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("diciembre pasa a enero del año siguiente", () => {
    const b = monthBoundsFor(new Date("2026-12-15T15:00:00Z"), tz);
    expect(b.endAt.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("un instante que en UTC ya es del mes siguiente pertenece al mes local", () => {
    // 2026-10-01T01:00Z todavía es 30 de septiembre en Rosario.
    const b = monthBoundsFor(new Date("2026-10-01T01:00:00Z"), tz);
    expect(b.startAt.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/free-hours.test.ts
```

Esperado: FALLA con `Failed to resolve import "./free-hours"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/bookings/free-hours.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { ACTIVE_BOOKING_STATUSES } from "./constants";
import { BOOKINGS_TIME_ZONE, localMoment, monthKeyOf } from "./time";

/**
 * Las horas bonificadas que le quedan al socio este mes, en un espacio.
 *
 * **No hace falta ninguna tabla.** "No se acumulan" significa que la bolsa se calcula
 * contando las reservas del mes calendario: el 1° arranca de cero solo, sin ningún proceso
 * que la reinicie y que pueda fallar o correrse.
 *
 * El mes es el LOCAL, no el de UTC: una reserva del 30 de septiembre a las 22 de Rosario
 * es de octubre en UTC, y contarla en octubre le regalaría dos horas al socio.
 */

export type FreeHoursBalance = {
  grantedMinutes: number;
  usedMinutes: number;
  availableMinutes: number;
  monthKey: string;
};

function entero(v: number): number {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Parte pura: dadas las horas otorgadas y las usadas, cuánto queda. */
export function computeFreeHoursBalance(input: {
  grantedHoursPerMonth: number;
  usedMinutes: number;
  monthKey: string;
}): FreeHoursBalance {
  const grantedMinutes = entero(input.grantedHoursPerMonth) * 60;
  const usedMinutes = entero(input.usedMinutes);
  return {
    grantedMinutes,
    usedMinutes,
    // Nunca negativa: si el dueño bajó las horas con reservas ya hechas, la bolsa es cero,
    // no una deuda que el socio tendría que pagar de más.
    availableMinutes: Math.max(0, grantedMinutes - usedMinutes),
    monthKey: input.monthKey,
  };
}

/**
 * El mes calendario local, en instantes.
 *
 * Se construye pidiéndole a la zona qué día es, retrocediendo al día 1 y a la medianoche.
 * Es la misma técnica que `weekRange`, por la misma razón: no hay biblioteca de fechas.
 */
export function monthBoundsFor(at: Date, timeZone: string): { startAt: Date; endAt: Date } {
  const m = localMoment(at, timeZone);
  const dia = Number(m.ymd.slice(8, 10));
  const MINUTO = 60_000;
  const startAt = new Date(at.getTime() - ((dia - 1) * 24 * 60 + m.minuteOfDay) * MINUTO);

  // Para el borde de arriba se avanza 32 días —más que cualquier mes— y se vuelve al día 1.
  const dentroDelSiguiente = new Date(startAt.getTime() + 32 * 24 * 60 * MINUTO);
  const m2 = localMoment(dentroDelSiguiente, timeZone);
  const dia2 = Number(m2.ymd.slice(8, 10));
  const endAt = new Date(
    dentroDelSiguiente.getTime() - ((dia2 - 1) * 24 * 60 + m2.minuteOfDay) * MINUTO,
  );

  return { startAt, endAt };
}

/**
 * Lo mismo, consultando la base.
 *
 * Cuentan las reservas que OCUPAN —`HOLD`, `PENDING_APPROVAL`, `CONFIRMED`—: una que está
 * esperando el pago ya consumió la bolsa, porque si no el socio podría abrir cinco
 * checkouts y gastar cinco veces las mismas dos horas.
 */
export async function loadFreeMinutesAvailable(input: {
  workspaceId: string;
  memberId: string;
  spaceId: string;
  grantedHoursPerMonth: number;
  at?: Date;
}): Promise<FreeHoursBalance> {
  const at = input.at ?? new Date();
  const { startAt, endAt } = monthBoundsFor(at, BOOKINGS_TIME_ZONE);

  const r = await prisma.booking.aggregate({
    where: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      spaceId: input.spaceId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startAt: { gte: startAt, lt: endAt },
    },
    _sum: { freeMinutesUsed: true },
  });

  return computeFreeHoursBalance({
    grantedHoursPerMonth: input.grantedHoursPerMonth,
    usedMinutes: r._sum.freeMinutesUsed ?? 0,
    monthKey: monthKeyOf(at, BOOKINGS_TIME_ZONE),
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/free-hours.test.ts
```

Esperado: PASA, 8 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/free-hours.ts lib/bookings/free-hours.test.ts
git commit -m "$(cat <<'MSG'
Las dos horas bonificadas del socio se cuentan por mes calendario

No se acumulan y por eso no hay tabla: se cuentan las reservas del mes. El 1°
la bolsa arranca de cero sola, sin un proceso que pueda fallar o correrse.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: El libro de comisiones aprende a hablar de una reserva

Hoy cada asiento del libro apunta a un pago de cuota (`membershipPaymentId`). Una comisión de reserva entraría sin referencia y nadie podría explicarla meses después.

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (una columna nullable en `WorkspaceFeeLedgerEntry`)
- Create: `packages/db/prisma/migrations/20260910000000_fee_ledger_booking/migration.sql`
- Modify: `lib/platform-fee/ledger.ts`
- Test: `lib/platform-fee/ledger-booking.test.ts`

**Interfaces:**
- Consumes: `splitMinorByPlatformFee` (`lib/platform-fee/fee.ts`), `withholdingForPayment` (`lib/platform-fee/debt.ts`), `pendingFeeDebtMinor` (`lib/platform-fee/ledger.ts`).
- Produces:
  - `recordAccrual` y `recordDischarge` aceptan ahora `{ membershipPaymentId?: string | null; bookingId?: string | null }`
  - `feeForBooking(input: { totalMinor: number; feeBps: number; pendingDebtMinor: number }): { ownFeeMinor: number; withholdMinor: number; netMinor: number; appliedToDebtMinor: number }` — puro

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/platform-fee/ledger-booking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { feeForBooking } from "./ledger-booking";

describe("la comisión de una reserva", () => {
  it("el 5% de lo cobrado, sin deuda arrastrada", () => {
    const r = feeForBooking({ totalMinor: 600_000, feeBps: 500, pendingDebtMinor: 0 });
    expect(r.ownFeeMinor).toBe(30_000);
    expect(r.withholdMinor).toBe(30_000);
    expect(r.netMinor).toBe(570_000);
    expect(r.appliedToDebtMinor).toBe(0);
  });

  it("una reserva sin cargo no genera comisión", () => {
    // Es la regla que hace que las horas bonificadas no le cuesten nada a nadie.
    const r = feeForBooking({ totalMinor: 0, feeBps: 500, pendingDebtMinor: 0 });
    expect(r.ownFeeMinor).toBe(0);
    expect(r.withholdMinor).toBe(0);
    expect(r.netMinor).toBe(0);
  });

  it("además de lo propio, retiene la deuda que quedó de los cobros a mano", () => {
    const r = feeForBooking({ totalMinor: 600_000, feeBps: 500, pendingDebtMinor: 20_000 });
    expect(r.ownFeeMinor).toBe(30_000);
    expect(r.withholdMinor).toBe(50_000);
    expect(r.appliedToDebtMinor).toBe(20_000);
    expect(r.netMinor).toBe(550_000);
  });

  it("nunca retiene más que el pago", () => {
    const r = feeForBooking({ totalMinor: 10_000, feeBps: 500, pendingDebtMinor: 900_000 });
    expect(r.withholdMinor).toBeLessThanOrEqual(10_000);
    expect(r.netMinor).toBeGreaterThanOrEqual(0);
  });

  it("las cuentas cierran: retenido más neto es exactamente el total", () => {
    for (const total of [1, 999, 100_000, 333_333, 600_001]) {
      const r = feeForBooking({ totalMinor: total, feeBps: 500, pendingDebtMinor: 7_777 });
      expect(r.withholdMinor + r.netMinor, String(total)).toBe(total);
    }
  });

  it("un fee fuera de rango cae al 5% en lugar de propagarse", () => {
    const r = feeForBooking({ totalMinor: 100_000, feeBps: 99_999, pendingDebtMinor: 0 });
    expect(r.ownFeeMinor).toBe(5_000);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/platform-fee/ledger-booking.test.ts
```

Esperado: FALLA con `Failed to resolve import "./ledger-booking"`.

- [ ] **Step 3: Escribir la parte pura**

Crear `lib/platform-fee/ledger-booking.ts`:

```ts
import { splitMinorByPlatformFee } from "./fee";
import { withholdingForPayment } from "./debt";

/**
 * Cuánto retiene la plataforma de una reserva cobrada por Mercado Pago.
 *
 * Es exactamente el mismo criterio que las cuotas —comisión propia primero, después la
 * deuda arrastrada de los cobros que no pasaron por Mercado Pago—, con una diferencia que
 * conviene dejar escrita: la base del cálculo es `totalArs`, que ya tiene descontadas las
 * horas bonificadas y ya tiene sumados los extras. **Nadie cobra comisión sobre plata que
 * no entró, ni deja de cobrarla sobre un extra que sí entró.**
 *
 * Módulo PURO: sin base y sin red.
 */
export function feeForBooking(input: {
  totalMinor: number;
  feeBps: number;
  pendingDebtMinor: number;
}): {
  ownFeeMinor: number;
  withholdMinor: number;
  netMinor: number;
  appliedToDebtMinor: number;
} {
  const propio = splitMinorByPlatformFee(input.totalMinor, input.feeBps);
  const reparto = withholdingForPayment({
    paymentMinor: input.totalMinor,
    ownFeeMinor: propio.feeMinor,
    pendingDebtMinor: input.pendingDebtMinor,
  });
  return {
    ownFeeMinor: propio.feeMinor,
    withholdMinor: reparto.withholdMinor,
    netMinor: reparto.netMinor,
    appliedToDebtMinor: reparto.appliedToDebtMinor,
  };
}
```

**Ojo con `splitMinorByPlatformFee`:** en `lib/platform-fee/fee.ts` la función que trabaja en centavos se llama así; verificá el nombre exacto exportado y su forma de retorno (`{ feeMinor, netMinor }`) antes de escribir esto. Si difiere, adaptá la llamada, no el resto.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/platform-fee/ledger-booking.test.ts
```

Esperado: PASA, 6 tests.

- [ ] **Step 5: Agregar la columna al schema**

En `packages/db/prisma/schema.prisma`, dentro de `WorkspaceFeeLedgerEntry`, junto a `membershipPaymentId`:

```prisma
  /// Reserva que originó el asiento, cuando el cobro vino de Reservas y no de Cuotas.
  /// Nullable y sin default: los asientos viejos no la tienen y no hace falta migrarlos.
  bookingId           String?
```

Y la relación, junto a `payment`:

```prisma
  booking            Booking?           @relation(fields: [bookingId], references: [id], onDelete: SetNull)
```

En el modelo `Booking`, la relación inversa, junto a `extraLines`:

```prisma
  feeLedgerEntries WorkspaceFeeLedgerEntry[]
```

- [ ] **Step 6: Escribir y aplicar la migración**

Crear `packages/db/prisma/migrations/20260910000000_fee_ledger_booking/migration.sql`:

```sql
-- El libro de comisiones puede referirse a una reserva, no solo a un pago de cuota.
-- Columna nullable: los asientos existentes quedan como están.

ALTER TABLE "WorkspaceFeeLedgerEntry" ADD COLUMN "bookingId" TEXT;

CREATE INDEX "WorkspaceFeeLedgerEntry_bookingId_idx" ON "WorkspaceFeeLedgerEntry"("bookingId");

ALTER TABLE "WorkspaceFeeLedgerEntry" ADD CONSTRAINT "WorkspaceFeeLedgerEntry_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Esto es una columna nueva en el schema compartido.** El cliente de Prisma la va a pedir en cada `SELECT` de esa tabla, así que hay que aplicarla en toda base donde alguna aplicación lea `WorkspaceFeeLedgerEntry` — hoy solo la de FotoOffice. **Pedir autorización antes de correrla contra producción.**

Verificación:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'WorkspaceFeeLedgerEntry' AND column_name = 'bookingId';
```

- [ ] **Step 7: Ampliar las funciones del libro**

En `lib/platform-fee/ledger.ts`, cambiar la firma de `recordAccrual` y `recordDischarge` para que acepten cualquiera de las dos referencias:

```ts
type ReferenciaAsiento = {
  membershipPaymentId?: string | null;
  bookingId?: string | null;
};
```

y reemplazar `membershipPaymentId: input.membershipPaymentId` por
`membershipPaymentId: input.membershipPaymentId ?? null, bookingId: input.bookingId ?? null`
en las dos.

**No cambiar el comportamiento de quien ya las usa.** `app/actions/dues-payment.ts` y `app/actions/manual-payment.ts` las llaman con `membershipPaymentId`; con el campo opcional siguen compilando y haciendo exactamente lo mismo.

- [ ] **Step 8: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

Esperado: sin errores y la suite verde salvo el fallo heredado de `lib/template-v2/access.test.ts`.

```bash
git add ../../packages/db/prisma/schema.prisma ../../packages/db/prisma/migrations/20260910000000_fee_ledger_booking lib/platform-fee/
git commit -m "$(cat <<'MSG'
La comisión de una reserva se puede explicar meses después

El libro apuntaba solo a pagos de cuota. Una columna nullable más y cada
asiento dice de qué reserva salió.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Cobrar una reserva por Mercado Pago

El mismo Checkout Pro que ya cobra las cuotas: token de la institución y `marketplace_fee` en la misma operación. El dinero no pasa por DNX.

**Files:**
- Create: `lib/bookings/checkout.ts`
- Test: `lib/bookings/checkout.test.ts`
- Create: `app/api/payments/mp/reservas-webhook/route.ts`

**Interfaces:**
- Consumes: `resolveWorkspaceCollector` (`lib/payments/connect/collector.ts`), `getPlatformFeeBps` (`lib/platform-fee/store.ts`), `pendingFeeDebtMinor` / `recordDischarge` (`lib/platform-fee/ledger.ts`), `feeForBooking` (Task 2), `createMercadoPagoCheckoutProLiveAdapter` (`@repo/payments/mercado-pago`), `appUrl` (`lib/app-url.ts`), `BOOKINGS_MODULE_KEY`.
- Produces:
  - `BOOKING_EXTERNAL_REFERENCE_PREFIX = "booking:"`
  - `bookingExternalReference(bookingId: string): string`
  - `parseBookingExternalReference(raw: string | null | undefined): string | null`
  - `startBookingCheckout(input: { workspaceId: string; bookingId: string; payerEmail: string; returnPath: string }): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }>`
  - `creditBookingPayment(input: { bookingId: string; providerPaymentId: string; paidAmountMinor: number }): Promise<{ applied: boolean; motivo?: string }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/checkout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BOOKING_EXTERNAL_REFERENCE_PREFIX,
  bookingExternalReference,
  parseBookingExternalReference,
} from "./checkout";

describe("cómo se reconoce un pago de reserva", () => {
  it("la referencia lleva el prefijo y el identificador", () => {
    expect(bookingExternalReference("abc123")).toBe(`${BOOKING_EXTERNAL_REFERENCE_PREFIX}abc123`);
  });

  it("lo que se escribe se vuelve a leer", () => {
    expect(parseBookingExternalReference(bookingExternalReference("abc123"))).toBe("abc123");
  });

  it("una referencia de cuotas NO se confunde con una de reservas", () => {
    // Las cuotas mandan el id pelado del MembershipPayment. Sin el prefijo, el webhook de
    // reservas acreditaría un pago de cuota contra una reserva inexistente.
    expect(parseBookingExternalReference("cmf9x0000abcd")).toBeNull();
  });

  it("basura o vacío no devuelve un identificador inventado", () => {
    expect(parseBookingExternalReference(null)).toBeNull();
    expect(parseBookingExternalReference(undefined)).toBeNull();
    expect(parseBookingExternalReference("")).toBeNull();
    expect(parseBookingExternalReference("booking:")).toBeNull();
    expect(parseBookingExternalReference("bookings:abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/checkout.test.ts
```

Esperado: FALLA con `Failed to resolve import "./checkout"`.

- [ ] **Step 3: Escribir el cobro**

Crear `lib/bookings/checkout.ts`:

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { appUrl } from "@/lib/app-url";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { feeForBooking } from "@/lib/platform-fee/ledger-booking";
import { pendingFeeDebtMinor, recordDischarge } from "@/lib/platform-fee/ledger";
import { BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Cobro de una reserva. Es el MISMO circuito que las cuotas: Checkout Pro con el token de
 * la institución y `marketplace_fee` retenido en la misma operación. El dinero no pasa por
 * DNX en ningún momento.
 *
 * ── Por qué un webhook propio y no el de cuotas ──
 *
 * El webhook de cuotas (`/api/payments/mp/webhook`) busca el pago entre los
 * `MembershipPayment` pendientes. Enseñarle a distinguir dos dominios lo volvería el punto
 * donde un error en reservas puede romper el cobro de las cuotas, que ya funciona en
 * producción. Un webhook aparte cuesta un archivo y no toca nada de lo que anda.
 */

export const BOOKING_EXTERNAL_REFERENCE_PREFIX = "booking:";

export function bookingExternalReference(bookingId: string): string {
  return `${BOOKING_EXTERNAL_REFERENCE_PREFIX}${bookingId}`;
}

/**
 * El identificador de reserva que viaja en un aviso de Mercado Pago, o null.
 *
 * El prefijo NO es decorativo: las cuotas mandan el id pelado, y sin él este webhook
 * acreditaría un pago de cuota contra una reserva que no existe.
 */
export function parseBookingExternalReference(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith(BOOKING_EXTERNAL_REFERENCE_PREFIX)) return null;
  const id = raw.slice(BOOKING_EXTERNAL_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export type CheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function startBookingCheckout(input: {
  workspaceId: string;
  bookingId: string;
  payerEmail: string;
  /** A dónde vuelve la persona después de pagar. Path interno. */
  returnPath: string;
}): Promise<CheckoutResult> {
  const reserva = await prisma.booking.findFirst({
    where: { id: input.bookingId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalArs: true,
      startAt: true,
      space: { select: { name: true } },
    },
  });
  if (!reserva) return { ok: false, error: "No encontramos esa reserva." };
  if (reserva.status !== "HOLD") {
    return { ok: false, error: "Esa reserva no está esperando el pago." };
  }
  if (reserva.paymentStatus === "PAID") {
    return { ok: false, error: "Esa reserva ya está paga." };
  }

  const totalMinor = decimalArsToMinor(reserva.totalArs);
  if (totalMinor <= 0) return { ok: false, error: "Esa reserva no tiene nada que pagar." };

  const base = appUrl();
  if (!base) return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };

  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) {
    // El mensaje habla de la institución, no de quien reserva: no puede resolverlo.
    return {
      ok: false,
      error: "La institución todavía no tiene los cobros habilitados. Escribile a la Secretaría.",
    };
  }

  const feeBps = await getPlatformFeeBps(input.workspaceId, BOOKINGS_MODULE_KEY);
  const deuda = await pendingFeeDebtMinor(input.workspaceId);
  const reparto = feeForBooking({ totalMinor, feeBps, pendingDebtMinor: deuda });

  // El fee se congela ANTES de ir a Mercado Pago: lo que se retuvo tiene que quedar escrito
  // aunque después cambie la configuración del workspace.
  await prisma.booking.update({
    where: { id: reserva.id },
    data: { feeBps, feeArs: minorToDecimalString(reparto.withholdMinor) },
  });

  const fecha = reserva.startAt.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: totalMinor,
      currency: "ARS",
      description: `${reserva.space.name} — ${fecha}`,
      externalReference: bookingExternalReference(reserva.id),
      idempotencyKey: randomUUID(),
      successUrl: `${base}${input.returnPath}?pago=ok`,
      pendingUrl: `${base}${input.returnPath}?pago=pendiente`,
      failureUrl: `${base}${input.returnPath}?pago=error`,
      notificationUrl: `${base}/api/payments/mp/reservas-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: reparto.withholdMinor,
      itemId: `reserva-${reserva.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { bookingId: reserva.id, workspaceId: input.workspaceId },
    });

    await prisma.booking.update({
      where: { id: reserva.id },
      data: { mpPreferenceId: preferencia.preferenceId ?? null },
    });

    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][reservas] MercadoPago rechazó la preferencia", {
      bookingId: reserva.id,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}

/**
 * Acredita un pago de reserva. **Idempotente**: un aviso repetido no acredita dos veces ni
 * escribe dos asientos en el libro de comisiones.
 */
export async function creditBookingPayment(input: {
  bookingId: string;
  providerPaymentId: string;
  paidAmountMinor: number;
}): Promise<{ applied: boolean; motivo?: string }> {
  return prisma.$transaction(async (tx) => {
    const reserva = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        paymentStatus: true,
        totalArs: true,
        feeArs: true,
        feeBps: true,
      },
    });
    if (!reserva) return { applied: false, motivo: "la reserva no existe" };
    if (reserva.paymentStatus === "PAID") return { applied: false, motivo: "aviso repetido" };
    if (reserva.status === "CANCELLED" || reserva.status === "EXPIRED") {
      // El horario ya se liberó. Se registra el pago igual para que quede el rastro, pero no
      // se revive la reserva: otra persona pudo haberlo tomado.
      return { applied: false, motivo: "la reserva ya no está activa" };
    }

    await tx.booking.update({
      where: { id: reserva.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        mpPaymentId: input.providerPaymentId,
        paidAt: new Date(),
        holdExpiresAt: null,
      },
    });

    // La comisión ya la retuvo Mercado Pago en la operación. El asiento negativo del libro
    // es lo que cancela la deuda arrastrada que venía incluida en esa retención.
    //
    // Se descuenta la comisión PROPIA de esta reserva usando el `feeBps` congelado en la
    // fila, no el 5% de memoria: si el workspace tiene otra comisión configurada, restar
    // 500 dejaría deuda cobrada sin asentar —o asentaría de más—.
    const retenido = decimalArsToMinor(reserva.feeArs);
    const propioMinor = splitMinorByPlatformFee(
      decimalArsToMinor(reserva.totalArs),
      reserva.feeBps,
    ).feeMinor;
    const aDeuda = Math.max(0, retenido - propioMinor);
    if (aDeuda > 0) {
      await recordDischarge(tx, {
        workspaceId: reserva.workspaceId,
        bookingId: reserva.id,
        amountMinor: aDeuda,
        note: `Deuda cobrada en la reserva ${reserva.id}`,
      });
    }

    return { applied: true };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/checkout.test.ts
```

Esperado: PASA, 4 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/bookings/checkout.ts lib/bookings/checkout.test.ts
git commit -m "$(cat <<'MSG'
La reserva se cobra por el mismo camino que las cuotas

Checkout Pro con el token de la institución y la comisión retenida en la misma
operación. El prefijo `booking:` en la referencia es lo que impide que un pago
de cuota se acredite contra una reserva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: El aviso de Mercado Pago

Webhook propio de reservas. No toca el de cuotas, que ya funciona en producción.

**Files:**
- Create: `app/api/payments/mp/reservas-webhook/route.ts`
- Test: `lib/bookings/webhook-payload.test.ts`
- Create: `lib/bookings/webhook-payload.ts`

**Interfaces:**
- Consumes: `parseBookingExternalReference`, `creditBookingPayment` (Task 3); `resolveWorkspaceCollector`; `createMercadoPagoCheckoutProLiveAdapter`.
- Produces: `extractPaymentId(body: unknown, url: URL): string | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/webhook-payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPaymentId } from "./webhook-payload";

const u = (q: string) => new URL(`https://app.example${q}`);

describe("de dónde sale el identificador del pago", () => {
  it("del cuerpo, que es lo habitual", () => {
    expect(extractPaymentId({ type: "payment", data: { id: 123 } }, u("/"))).toBe("123");
  });

  it("de la query, que es como avisa el modo viejo", () => {
    expect(extractPaymentId({}, u("/?type=payment&data.id=456"))).toBe("456");
  });

  it("acepta el identificador como número o como texto", () => {
    expect(extractPaymentId({ data: { id: "789" } }, u("/"))).toBe("789");
  });

  it("un aviso que no es de pago se ignora", () => {
    expect(extractPaymentId({ type: "plan", data: { id: 1 } }, u("/"))).toBeNull();
    expect(extractPaymentId({}, u("/?type=subscription&data.id=1"))).toBeNull();
  });

  it("sin identificador devuelve null, no un texto vacío", () => {
    expect(extractPaymentId({}, u("/"))).toBeNull();
    expect(extractPaymentId(null, u("/"))).toBeNull();
    expect(extractPaymentId({ data: {} }, u("/"))).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/webhook-payload.test.ts
```

Esperado: FALLA con `Failed to resolve import "./webhook-payload"`.

- [ ] **Step 3: Escribir el parseo**

Crear `lib/bookings/webhook-payload.ts`:

```ts
/**
 * De dónde sale el identificador del pago en un aviso de Mercado Pago. PURO.
 *
 * Mercado Pago avisa de dos formas —cuerpo JSON o parámetros en la URL— y manda avisos de
 * cosas que no son pagos. Separarlo del `route.ts` permite probar los cuatro casos sin
 * levantar Next.
 */
export function extractPaymentId(body: unknown, url: URL): string | null {
  const cuerpo = (typeof body === "object" && body !== null ? body : {}) as {
    type?: unknown;
    data?: { id?: unknown };
  };

  const tipo =
    (typeof cuerpo.type === "string" ? cuerpo.type : null) ?? url.searchParams.get("type") ?? "";
  if (tipo && tipo !== "payment") return null;

  const crudo =
    cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? null;
  if (crudo === null || crudo === undefined) return null;

  const id = String(crudo).trim();
  return id.length > 0 ? id : null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/webhook-payload.test.ts
```

Esperado: PASA, 5 tests.

- [ ] **Step 5: Escribir la ruta**

Crear `app/api/payments/mp/reservas-webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { creditBookingPayment, parseBookingExternalReference } from "@/lib/bookings/checkout";

export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago sobre el pago de una reserva.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo. Devolver un error hace que
 * Mercado Pago reintente durante días, y el problema casi nunca se arregla reintentando.
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El importe, el
 * estado y a qué reserva corresponde se le preguntan a Mercado Pago con el token de la
 * institución. Un cuerpo falsificado no puede acreditar un pago que no existe.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cuerpo = await request.json().catch(() => null);
  const providerPaymentId = extractPaymentId(cuerpo, url);
  if (!providerPaymentId) {
    return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });
  }

  try {
    // Ya acreditado: no hace falta volver a preguntarle a Mercado Pago.
    const yaPago = await prisma.booking.findFirst({
      where: { mpPaymentId: providerPaymentId },
      select: { paymentStatus: true },
    });
    if (yaPago?.paymentStatus === "PAID") {
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    // Para consultar el pago hace falta el token de alguna institución. Se resuelve por las
    // reservas que están esperando pago: son las únicas que pueden corresponder a este aviso.
    const esperando = await prisma.booking.findMany({
      where: { status: "HOLD", paymentStatus: "PENDING" },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      take: 20,
    });

    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    for (const { workspaceId } of esperando) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;

      const pago = await adapter
        .getPayment({
          paymentId: providerPaymentId,
          accessTokenOverride: collector.collector.accessToken,
        })
        .catch(() => null);
      if (!pago) continue;

      const bookingId = parseBookingExternalReference(pago.externalReference);
      if (!bookingId) {
        // Es un pago de otra cosa —una cuota, un curso—: no es de este webhook.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es una reserva" });
      }
      if (pago.status !== "approved") {
        return NextResponse.json({ ok: true, applied: false, motivo: `estado ${pago.status}` });
      }

      const r = await creditBookingPayment({
        bookingId,
        providerPaymentId,
        paidAmountMinor: pago.amountMinor ?? 0,
      });
      return NextResponse.json({ ok: true, ...r });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][reservas] falló el aviso de MercadoPago", {
      providerPaymentId,
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
```

**Antes de escribirlo, verificar la forma real del adaptador.** `createMercadoPagoCheckoutProLiveAdapter` puede no exponer `getPayment` con esa firma. Mirar `app/api/payments/mp/webhook/route.ts`, que ya consulta un pago con el token de la institución, y **copiar de ahí la llamada exacta y los nombres de los campos de la respuesta** (`status`, `externalReference`, importe). Ese archivo funciona en producción; es la fuente de verdad.

- [ ] **Step 6: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/webhook-payload.ts lib/bookings/webhook-payload.test.ts app/api/payments/mp/reservas-webhook
git commit -m "$(cat <<'MSG'
Cuando el socio paga, la reserva queda confirmada sola

Webhook propio: enseñarle dos dominios al de cuotas lo volvería el lugar donde
un error en reservas rompe el cobro que ya funciona.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Transferencia, aprobación y vencimiento

Los tres caminos que no pasan por Mercado Pago. Van juntos porque comparten el mismo estado y las mismas pantallas.

**Files:**
- Create: `lib/bookings/lifecycle.ts`
- Test: `lib/bookings/lifecycle.test.ts`
- Modify: `app/(shell)/reservas/actions.ts`
- Create: `app/api/cron/reservas-vencimientos/route.ts`

**Interfaces:**
- Consumes: `ACTIVE_BOOKING_STATUSES`; `recordAccrual` (Task 2); `getPlatformFeeBps`; `splitMinorByPlatformFee`.
- Produces:
  - `canCancelByCustomer(input: { startAt: Date; status: string; cancelWindowHours: number; now: Date }): { ok: true } | { ok: false; motivo: string }`
  - `confirmTransferPayment(input: { workspaceId: string; bookingId: string; byUserId: number }): Promise<{ ok: boolean; error?: string }>`
  - `approveBooking(input: { workspaceId: string; bookingId: string; byUserId: number; removeExtraLineIds: string[] }): Promise<{ ok: boolean; error?: string }>`
  - `expireStaleHolds(now?: Date): Promise<{ expiradas: number }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCancelByCustomer } from "./lifecycle";

const ahora = new Date("2026-09-19T12:00:00Z");
const en48h = new Date("2026-09-21T12:00:00Z");
const en2h = new Date("2026-09-19T14:00:00Z");

describe("hasta cuándo puede cancelar quien reservó", () => {
  it("con 48 horas por delante y una ventana de 24, puede", () => {
    expect(
      canCancelByCustomer({ startAt: en48h, status: "CONFIRMED", cancelWindowHours: 24, now: ahora }),
    ).toEqual({ ok: true });
  });

  it("con 2 horas por delante y una ventana de 24, ya no", () => {
    const r = canCancelByCustomer({
      startAt: en2h,
      status: "CONFIRMED",
      cancelWindowHours: 24,
      now: ahora,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("24");
  });

  it("una ventana de cero deja cancelar hasta el momento de empezar", () => {
    expect(
      canCancelByCustomer({ startAt: en2h, status: "CONFIRMED", cancelWindowHours: 0, now: ahora }),
    ).toEqual({ ok: true });
  });

  it("una reserva ya empezada no se cancela", () => {
    const r = canCancelByCustomer({
      startAt: new Date("2026-09-19T11:00:00Z"),
      status: "CONFIRMED",
      cancelWindowHours: 0,
      now: ahora,
    });
    expect(r.ok).toBe(false);
  });

  it("una reserva ya cancelada o vencida no se vuelve a cancelar", () => {
    for (const status of ["CANCELLED", "EXPIRED"]) {
      const r = canCancelByCustomer({ startAt: en48h, status, cancelWindowHours: 24, now: ahora });
      expect(r.ok, status).toBe(false);
    }
  });

  it("una que está esperando el pago sí se puede soltar", () => {
    // Es lo que hace que el socio pueda arrepentirse sin esperar el vencimiento.
    expect(
      canCancelByCustomer({ startAt: en48h, status: "HOLD", cancelWindowHours: 24, now: ahora }),
    ).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/lifecycle.test.ts
```

Esperado: FALLA con `Failed to resolve import "./lifecycle"`.

- [ ] **Step 3: Escribir el ciclo de vida**

Crear `lib/bookings/lifecycle.ts` con la parte pura primero:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { recordAccrual } from "@/lib/platform-fee/ledger";
import { ACTIVE_BOOKING_STATUSES, BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Los tres caminos que no pasan por Mercado Pago: la transferencia que alguien confirma a
 * mano, la aprobación de lo que requiere coordinarse, y el vencimiento de lo que nadie pagó.
 */

/**
 * ¿Puede cancelar quien reservó, por su cuenta?
 *
 * Parte PURA. Después del plazo solo cancela la institución — no porque el sistema quiera
 * ser rígido, sino porque a esa altura ya se organizó algo alrededor de esa reserva.
 */
export function canCancelByCustomer(input: {
  startAt: Date;
  status: string;
  cancelWindowHours: number;
  now: Date;
}): { ok: true } | { ok: false; motivo: string } {
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, motivo: "Esa reserva ya no está activa." };
  }

  const faltanMs = input.startAt.getTime() - input.now.getTime();
  if (faltanMs <= 0) return { ok: false, motivo: "Esa reserva ya empezó." };

  const ventanaMs = Math.max(0, input.cancelWindowHours) * 60 * 60 * 1000;
  if (faltanMs < ventanaMs) {
    return {
      ok: false,
      motivo: `Se puede cancelar hasta ${input.cancelWindowHours} horas antes. Escribile a la Secretaría.`,
    };
  }

  return { ok: true };
}

/**
 * La Secretaría confirma que la transferencia llegó.
 *
 * Ese dinero **no pasa por Mercado Pago**, así que no hay de dónde retener la comisión: se
 * anota como deuda de la institución y se cobra de los próximos cobros que sí entren por
 * ahí. Es exactamente lo que ya pasa con las cuotas cobradas en efectivo.
 */
export async function confirmTransferPayment(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const reserva = await tx.booking.findFirst({
        where: { id: input.bookingId, workspaceId: input.workspaceId },
        select: { id: true, status: true, paymentStatus: true, totalArs: true },
      });
      if (!reserva) return { ok: false, error: "No encontramos esa reserva." };
      if (reserva.paymentStatus === "PAID") return { ok: false, error: "Esa reserva ya está paga." };
      if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(reserva.status)) {
        return { ok: false, error: "Esa reserva ya no está activa." };
      }

      const totalMinor = decimalArsToMinor(reserva.totalArs);
      const feeBps = await getPlatformFeeBps(input.workspaceId, BOOKINGS_MODULE_KEY);
      const feeMinor = splitMinorByPlatformFee(totalMinor, feeBps).feeMinor;

      await tx.booking.update({
        where: { id: reserva.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          paidAt: new Date(),
          holdExpiresAt: null,
          decidedByUserId: input.byUserId,
          feeBps,
          feeArs: minorToDecimalString(feeMinor),
        },
      });

      await recordAccrual(tx, {
        workspaceId: input.workspaceId,
        bookingId: reserva.id,
        amountMinor: feeMinor,
        note: `Comisión de la reserva ${reserva.id}, cobrada por transferencia`,
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo confirmar la transferencia", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos confirmar el pago. Probá de nuevo en un rato." };
  }
}

/**
 * La institución resuelve una reserva que estaba a aprobar.
 *
 * Puede quitar extras que no se pudieron conseguir —la modelo que no estaba disponible—, y
 * el total se recalcula con lo que quedó. Recién ahí la reserva pasa a esperar el pago.
 *
 * Los extras quitados pasan a `REMOVED` y dejan de comprometer inventario, en la misma
 * transacción: si se hiciera en dos pasos, entre uno y otro ese flash figuraría tomado.
 */
export async function approveBooking(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number;
  removeExtraLineIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const reserva = await tx.booking.findFirst({
        where: { id: input.bookingId, workspaceId: input.workspaceId, status: "PENDING_APPROVAL" },
        select: { id: true, totalArs: true, extraLines: { select: { id: true, amountArs: true } } },
      });
      if (!reserva) return { ok: false, error: "Esa reserva no está esperando aprobación." };

      const quitar = new Set(input.removeExtraLineIds);
      if (quitar.size > 0) {
        await tx.bookingExtraLine.updateMany({
          where: { id: { in: [...quitar] }, bookingId: reserva.id },
          data: { status: "REMOVED" },
        });
      }

      const descontado = reserva.extraLines
        .filter((l) => quitar.has(l.id))
        .reduce((s, l) => s + decimalArsToMinor(l.amountArs), 0);
      const nuevoTotal = Math.max(0, decimalArsToMinor(reserva.totalArs) - descontado);

      // Las líneas que quedan pasan a confirmadas: ya no están "a la espera de que alguien
      // decida", que es lo que significaba PENDING_CONFIRMATION.
      await tx.bookingExtraLine.updateMany({
        where: { bookingId: reserva.id, status: "PENDING_CONFIRMATION" },
        data: { status: "CONFIRMED" },
      });

      const sinCargo = nuevoTotal === 0;
      await tx.booking.update({
        where: { id: reserva.id },
        data: {
          status: sinCargo ? "CONFIRMED" : "HOLD",
          totalArs: minorToDecimalString(nuevoTotal),
          paymentMethod: sinCargo ? "SIN_CARGO" : undefined,
          paymentStatus: sinCargo ? "NOT_REQUIRED" : "PENDING",
          decidedByUserId: input.byUserId,
        },
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo aprobar", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos aprobar la reserva. Probá de nuevo en un rato." };
  }
}

/**
 * Libera los bloqueos que nadie pagó ni resolvió.
 *
 * **Idempotente**: correrla dos veces deja el mismo resultado. Un bloqueo vencido no puede
 * volver a vencer, y una reserva pagada nunca entra en el filtro.
 */
export async function expireStaleHolds(now: Date = new Date()): Promise<{ expiradas: number }> {
  const r = await prisma.booking.updateMany({
    where: {
      status: { in: ["HOLD", "PENDING_APPROVAL"] },
      paymentStatus: { not: "PAID" },
      holdExpiresAt: { not: null, lte: now },
    },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  return { expiradas: r.count };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/lifecycle.test.ts
```

Esperado: PASA, 6 tests.

- [ ] **Step 5: El proceso programado**

Crear `app/api/cron/reservas-vencimientos/route.ts`, siguiendo exactamente el patrón de `app/api/cron/conciliar-cuotas/route.ts`:

```ts
import { NextResponse } from "next/server";
import { expireStaleHolds } from "@/lib/bookings/lifecycle";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Libera los horarios bloqueados que nadie pagó.
 *
 * Pensada para correr cada 15 minutos. Es idempotente: correrla de más no rompe nada.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await expireStaleHolds();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][reservas] falló la expiración de bloqueos", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la expiración" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
```

Y agregarlo a `apps/fotoffice/vercel.json`, en el arreglo `crons` que ya existe:

```json
    {
      "path": "/api/cron/reservas-vencimientos",
      "schedule": "*/15 * * * *"
    }
```

- [ ] **Step 6: Las acciones de la agenda**

Agregar a `app/(shell)/reservas/actions.ts` tres acciones que envuelven lo anterior, siguiendo el patrón de las que ya están (`requireBookingsStaff`, `revalidatePath`, `redirect` con `?ok=` o `?error=`):

- `confirmTransferAction(formData)` — lee `bookingId`, llama a `confirmTransferPayment`, vuelve a `/reservas`.
- `approveBookingAction(formData)` — lee `bookingId` y los `removeExtraLineIds` marcados, llama a `approveBooking`, vuelve a `/reservas`.
- `rejectBookingAction(formData)` — lee `bookingId` y `reason`, llama a `cancelBooking` (que ya existe), vuelve a `/reservas`.

- [ ] **Step 7: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/lifecycle.ts lib/bookings/lifecycle.test.ts app/api/cron/reservas-vencimientos "app/(shell)/reservas/actions.ts" vercel.json
git commit -m "$(cat <<'MSG'
La transferencia se confirma, lo que hay que coordinar se aprueba y lo impago vence

La comisión de una transferencia no pasa por Mercado Pago: se anota como deuda
de la institución y se cobra de los próximos cobros que sí entren por ahí.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Reservar desde el portal

La pantalla del socio. Elige espacio, ve los huecos reales, elige el rango y los extras, y ve el precio desglosado antes de confirmar.

**Files:**
- Create: `lib/bookings/portal.ts`
- Test: `lib/bookings/portal.test.ts`
- Create: `app/portal/reservas/page.tsx`
- Create: `app/portal/reservas/actions.ts`
- Create: `app/portal/reservas/reservar-form.tsx`

**Interfaces:**
- Consumes: `loadPortalContext` (`lib/portal/access.ts`); `listSpaces`, `listExtras`, `listResources`, `listResourceCommitments`, `loadAvailabilityContext` (`lib/bookings/repository.ts`); `computeAvailability` (`lib/bookings/availability.ts`); `loadFreeMinutesAvailable` (Task 1); `offerExtras`, `extrasTotalMinor`, `anyRequiresConfirmation` (`lib/bookings/extras.ts`); `quoteBooking`, `describeQuote` (`lib/bookings/pricing.ts`); `createBooking` (`lib/bookings/create.ts`); `startBookingCheckout` (Task 3); `parseLocalDateTime`.
- Produces:
  - `type PortalBookingOffer = { space: SpaceRecord; slots: Interval[]; freeHours: FreeHoursBalance; extras: ExtraOffer[] }`
  - `loadPortalOffer(input: { workspaceId: string; memberId: string; spaceId: string; range: Interval; now?: Date }): Promise<PortalBookingOffer | null>`
  - Server action `createPortalBookingAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/bookings/portal.test.ts`. Prueba la pieza que **no** existe todavía: juntar el precio del espacio con el de los extras en un total único.

```ts
import { describe, expect, it } from "vitest";
import { totalForBooking } from "./portal";

const quote = { freeMinutesUsed: 120, billedMinutes: 120, hourlyPriceMinor: 300_000, totalMinor: 600_000 };

describe("el total que ve el socio", () => {
  it("suma el espacio y los extras elegidos", () => {
    expect(totalForBooking({ quote, extrasMinor: 50_000 })).toBe(650_000);
  });

  it("sin extras, es solo el espacio", () => {
    expect(totalForBooking({ quote, extrasMinor: 0 })).toBe(600_000);
  });

  it("las horas bonificadas NO cubren los extras", () => {
    // Es la regla del diseño: el espacio sale $0 y la máquina de humo se paga igual.
    const cubierta = { ...quote, billedMinutes: 0, totalMinor: 0 };
    expect(totalForBooking({ quote: cubierta, extrasMinor: 50_000 })).toBe(50_000);
  });

  it("una reserva enteramente bonificada y sin extras no cuesta nada", () => {
    const cubierta = { ...quote, billedMinutes: 0, totalMinor: 0 };
    expect(totalForBooking({ quote: cubierta, extrasMinor: 0 })).toBe(0);
  });

  it("un importe de extras absurdo no ensucia el total", () => {
    expect(totalForBooking({ quote, extrasMinor: -1 })).toBe(600_000);
    expect(totalForBooking({ quote, extrasMinor: Number.NaN })).toBe(600_000);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/bookings/portal.test.ts
```

Esperado: FALLA con `Failed to resolve import "./portal"`.

- [ ] **Step 3: Escribir el módulo del portal**

Crear `lib/bookings/portal.ts`. Empieza por la parte pura:

```ts
import "server-only";
import type { Quote } from "./pricing";

/**
 * El total de una reserva: el espacio más los extras.
 *
 * **Las horas bonificadas cubren el espacio, no los extras.** El socio con dos horas libres
 * en el estudio paga $0 el espacio y sí paga la máquina de humo. Bonificar el espacio es el
 * beneficio que da la cuota; regalar el equipamiento no se decidió nunca.
 *
 * Parte PURA.
 */
export function totalForBooking(input: { quote: Quote; extrasMinor: number }): number {
  const extras =
    Number.isFinite(input.extrasMinor) && input.extrasMinor > 0 ? Math.floor(input.extrasMinor) : 0;
  return input.quote.totalMinor + extras;
}
```

Y después `loadPortalOffer`, que junta todo lo que la pantalla necesita para un espacio y una ventana: los huecos (`computeAvailability` sobre `loadAvailabilityContext`), la bolsa de horas (`loadFreeMinutesAvailable`), y los extras ofrecibles (`offerExtras` con `listExtras({ spaceId, onlyActive: true })`, `listResources` y `listResourceCommitments`). Devuelve `null` si el espacio no existe o no está activo.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/bookings/portal.test.ts
```

Esperado: PASA, 5 tests.

- [ ] **Step 5: La acción de reservar**

Crear `app/portal/reservas/actions.ts`. El orden importa y es el que sigue:

1. `loadPortalContext(user.id)`; sin ficha de socio, se corta.
2. Verificar que el módulo esté habilitado para ese workspace.
3. Leer `spaceId`, `startAt`/`endAt` con `parseLocalDateTime`, y los `extraIds` marcados.
4. `loadPortalOffer` para ese espacio y ese rango, **con los datos de este instante**: lo que tenía la pantalla puede estar viejo.
5. `offerExtras` sobre ese rango; descartar los elegidos que no estén disponibles.
6. `quoteBooking` con `freeMinutesAvailable` de la bolsa, y `totalForBooking` con los extras.
7. `createBooking` — que vuelve a validar todo dentro de su transacción.
8. Crear las `BookingExtraLine` en la misma transacción que la reserva, con `nameSnapshot`, `unitPriceArs`, `unitsConsumed` y `amountArs` congelados, y `status` en `PENDING_CONFIRMATION` si el extra requiere confirmación o `CONFIRMED` si no.
9. Si `anyRequiresConfirmation`, la reserva queda en `PENDING_APPROVAL` y **no se cobra**: se redirige a `/portal/reservas?enviada=1` con el aviso de que la Secretaría va a resolverlo.
10. Si no, y el total es mayor que cero: `startBookingCheckout` y redirigir al `checkoutUrl`.
11. Si el total es cero, la reserva ya nació `CONFIRMED`: redirigir a `/portal/reservas?ok=1`.

**Los pasos 7 y 8 tienen que estar en la misma transacción.** Si la reserva se guardara y las líneas de extras fallaran, quedaría un horario tomado sin los extras que la persona pidió y pagó.

Esto obliga a ampliar `createBooking` en `lib/bookings/create.ts` con un parámetro opcional `extraLines`, que se insertan dentro de su `$transaction`. Hacerlo ahí y no con una transacción propia: es el único lugar que ya tiene el `tx` con la reserva creada.

- [ ] **Step 6: La pantalla**

Crear `app/portal/reservas/page.tsx`. Estructura:

1. `PageHeader` con "Reservas" y la descripción "Reservá el estudio, el salón o el coworking."
2. Si no hay espacios activos: un vacío que lo diga sin culpar a nadie.
3. Selector de espacio (enlaces con `?espacio=<id>`, sin estado en el navegador).
4. Para el espacio elegido: la bolsa de horas del mes, en una línea — *"Te quedan 2 de 2 horas bonificadas este mes en el Estudio."*
5. Los huecos de los próximos días, agrupados por día, como botones que completan el formulario.
6. Los extras disponibles para ese espacio, con su precio y su estado. Los agotados se muestran **deshabilitados y con el motivo**, no escondidos.
7. El desglose del precio con `describeQuote`, y el aviso cuando algún extra elegido requiere confirmación: *"Tu pedido va a quedar a la espera de que la institución confirme la modelo. No se te va a cobrar nada hasta entonces."*
8. Abajo, "Mis reservas": las que vienen y las pasadas, con el botón de cancelar cuando `canCancelByCustomer` lo permite, y el aviso de que la devolución del dinero la resuelve la institución.

Usar las clases del design system, igual que `app/portal/cuotas/page.tsx`.

- [ ] **Step 7: Encender la sección en el menú del portal**

En `lib/portal/menu.ts`, la entrada de Reservas (orden 60) pasa de `built: false` a `built: true`. Ya declara `requiresModule: "bookings"`, así que sigue apareciendo solo donde el módulo esté encendido.

Hay tests que fallan si una sección declarada no tiene su pantalla: correr `pnpm test lib/portal/` y confirmar que pasan.

- [ ] **Step 8: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/portal.ts lib/bookings/portal.test.ts lib/bookings/create.ts app/portal/reservas lib/portal/menu.ts
git commit -m "$(cat <<'MSG'
El socio reserva su horario, elige sus extras y paga

Las horas bonificadas cubren el espacio y no los extras: el estudio sale $0 y
la máquina de humo se paga igual.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: La agenda aprende a decidir

El equipo confirma transferencias, aprueba lo que estaba a la espera y quita los extras que no consiguió.

**Files:**
- Modify: `app/(shell)/reservas/page.tsx`

**Interfaces:**
- Consumes: `confirmTransferAction`, `approveBookingAction`, `rejectBookingAction` (Task 5); `listBookingsInRange`.

- [ ] **Step 1: Ampliar la consulta de la agenda**

En `lib/bookings/repository.ts`, `listBookingsInRange` tiene que traer también las líneas de extras de cada reserva:

```ts
      extraLines: {
        where: { status: { not: "REMOVED" } },
        select: { id: true, nameSnapshot: true, amountArs: true, status: true },
      },
```

y `BookingRow` sumar el campo correspondiente.

- [ ] **Step 2: Mostrar y decidir**

En `app/(shell)/reservas/page.tsx`, para cada reserva:

- Listar sus extras debajo del nombre, y marcar los que están `PENDING_CONFIRMATION` con "a confirmar".
- Si el estado es `HOLD` y el medio es `TRANSFERENCIA`: un botón **"Confirmar transferencia"** (`confirmTransferAction`).
- Si el estado es `PENDING_APPROVAL`: un bloque con las líneas a confirmar, cada una con una casilla "no se pudo conseguir", y dos botones — **"Aprobar"** (`approveBookingAction`, manda los `removeExtraLineIds` marcados) y **"Rechazar"** (`rejectBookingAction`, pide motivo).

Debajo del botón de aprobar, la consecuencia con todas las letras: *"Al aprobar se le manda el enlace de pago con el total definitivo."*

- [ ] **Step 3: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test
```

```bash
git add lib/bookings/repository.ts "app/(shell)/reservas/page.tsx"
git commit -m "$(cat <<'MSG'
La Secretaría confirma transferencias y resuelve lo que había que coordinar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Reserva pública para no socios

**Files:**
- Create: `app/w/[slug]/reservas/page.tsx`
- Create: `app/w/[slug]/reservas/actions.ts`

**Interfaces:**
- Consumes: lo mismo que el portal, con `customerType: "NON_MEMBER"` y `freeMinutesAvailable: 0`.

- [ ] **Step 1: La pantalla**

Crear `app/w/[slug]/reservas/page.tsx`, dentro del sitio público del workspace. Resuelve el workspace por `FotofficeWorkspaceBranding.publicSlug`, igual que las otras pantallas de `app/w/[slug]/`.

Solo lista los espacios con `allowsNonMembers: true`. Muestra la tarifa de no socio, y un aviso: *"Si sos socio, entrá a tu portal: el precio es menor y tenés horas bonificadas."*

- [ ] **Step 2: Exigir cuenta**

Reservar exige sesión. Si no hay, el botón lleva a `/login?next=/w/<slug>/reservas`. **No se acepta una reserva anónima**: sin cuenta no se puede reconocer a quien ocupó el espacio ni avisarle si algo cambia.

- [ ] **Step 3: Solo Mercado Pago**

En la acción pública, `paymentMethod` es siempre `MERCADO_PAGO`. La transferencia exige a alguien que la concilie, y para un desconocido eso es un horario bloqueado sin garantía. La pantalla lo dice: *"El horario queda reservado cuando se acredita el pago."*

- [ ] **Step 4: Verificar y commitear**

```bash
npx tsc --noEmit && pnpm test && pnpm lint
```

```bash
git add "app/w/[slug]/reservas"
git commit -m "$(cat <<'MSG'
La institución alquila sus espacios también a quien no es socio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Documentación y verificación de punta a punta

- [ ] **Step 1: Actualizar los documentos**

En `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §5, la fila de Reservas del portal pasa de ⬜ a ✅.

En `docs/fotoffice/ESTADO-ACTUAL.md`, actualizar la fila "9 — Reservas" a `CONSTRUIDO` y registrar la migración `20260910000000_fee_ledger_booking` y el proceso programado nuevo.

- [ ] **Step 2: El circuito completo, en el navegador**

Con el módulo encendido para la SFPR y un socio de prueba:

1. Entrar como socio a `/portal/reservas`, elegir el estudio.
2. Confirmar que dice **"Te quedan 2 de 2 horas bonificadas este mes"**.
3. Reservar 2 horas sin extras → total **$0**, se confirma sin pasar por Mercado Pago.
4. Volver: ahora dice **"Te quedan 0 de 2"**.
5. Reservar 2 horas más → ahora **sí cobra**, a precio de socio.
6. Agregar la máquina de humo → el total sube. Confirmar que **las horas bonificadas no la cubrieron**.
7. Pedir la modelo → la reserva queda **"a la espera"** y **no aparece ningún enlace de pago**.
8. Como Secretaría, en `/reservas`: aprobar quitando la modelo → el total baja y recién ahí sale el pago.
9. Elegir transferencia en otra reserva → el horario queda tomado con su vencimiento.
10. Confirmar la transferencia desde la agenda → se confirma, y en el libro de comisiones aparece el asiento devengado.
11. Verificar en la base que el asiento tiene el `bookingId` cargado.

- [ ] **Step 3: Commitear**

```bash
git add docs/fotoffice/
git commit -m "$(cat <<'MSG'
El mapa de navegación y el estado quedan al día con el portal de reservas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Qué queda funcionando al terminar

El socio entra a su portal, ve cuántas horas bonificadas le quedan este mes, elige un horario libre y los extras disponibles, ve el precio desglosado y paga por Mercado Pago o por transferencia. Lo que hay que coordinar con una persona queda a la espera y no le cobra nada hasta que la institución resuelva. Los horarios que nadie paga se liberan solos. La comisión del 5% se retiene donde se puede y se anota donde no, y cada asiento dice de qué reserva salió.

El no socio reserva desde el sitio público, con su cuenta y a tarifa plena.

## Lo que sigue, en otra etapa

- El espejo con Google Calendar en las dos direcciones — la conexión ya existe, falta usarla.
- Devoluciones automáticas por Mercado Pago.
- Reservas recurrentes.
- Avisos por email al reservar, al aprobar y al vencer.
