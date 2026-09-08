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

  it("respeta una comisión distinta del 5%", () => {
    // Si alguien vuelve a clavar 500 en algún cálculo, este test lo agarra.
    const r = feeForBooking({ totalMinor: 100_000, feeBps: 1_000, pendingDebtMinor: 0 });
    expect(r.ownFeeMinor).toBe(10_000);
  });

  it("un fee fuera de rango cae al 5% en lugar de propagarse", () => {
    const r = feeForBooking({ totalMinor: 100_000, feeBps: 99_999, pendingDebtMinor: 0 });
    expect(r.ownFeeMinor).toBe(5_000);
  });
});
