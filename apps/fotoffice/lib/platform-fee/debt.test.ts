import { describe, expect, it } from "vitest";
import { accrualForManualPayment, withholdingForPayment } from "./debt";

const DESDE = "2026-09";

describe("accrualForManualPayment", () => {
  it("devenga sobre todo lo cobrado", () => {
    expect(accrualForManualPayment(8_000_00, 500)).toBe(400_00);
    expect(accrualForManualPayment(24_000_00, 500)).toBe(1_200_00);
  });

  it("un importe inválido no devenga nada", () => {
    expect(accrualForManualPayment(0, 500)).toBe(0);
    expect(accrualForManualPayment(-8_000_00, 500)).toBe(0);
    expect(accrualForManualPayment(1.5, 500)).toBe(0);
  });

  it("una comisión de cero se respeta", () => {
    expect(accrualForManualPayment(8_000_00, 0)).toBe(0);
  });
});

describe("withholdingForPayment", () => {
  it("sin deuda arrastrada retiene solo su propia comisión", () => {
    const r = withholdingForPayment({ paymentMinor: 8_000_00, ownFeeMinor: 400_00, pendingDebtMinor: 0 });
    expect(r).toEqual({ withholdMinor: 400_00, appliedToDebtMinor: 0, remainingDebtMinor: 0, netMinor: 7_600_00 });
  });

  it("con deuda chica retiene su comisión y cancela la deuda entera", () => {
    const r = withholdingForPayment({ paymentMinor: 8_000_00, ownFeeMinor: 400_00, pendingDebtMinor: 1_000_00 });
    expect(r.withholdMinor).toBe(1_400_00);
    expect(r.appliedToDebtMinor).toBe(1_000_00);
    expect(r.remainingDebtMinor).toBe(0);
    expect(r.netMinor).toBe(6_600_00);
  });

  /** Decisión de Daniel: se retiene todo lo que entre, sin tope. El resto se arrastra. */
  it("con deuda mayor que el pago retiene todo y arrastra el resto", () => {
    const r = withholdingForPayment({ paymentMinor: 8_000_00, ownFeeMinor: 400_00, pendingDebtMinor: 50_000_00 });
    expect(r.withholdMinor).toBe(8_000_00);
    expect(r.appliedToDebtMinor).toBe(7_600_00);
    expect(r.remainingDebtMinor).toBe(42_400_00);
    expect(r.netMinor).toBe(0);
  });

  it("la deuda que entra justa deja saldo cero y neto cero", () => {
    const r = withholdingForPayment({ paymentMinor: 8_000_00, ownFeeMinor: 400_00, pendingDebtMinor: 7_600_00 });
    expect(r.remainingDebtMinor).toBe(0);
    expect(r.netMinor).toBe(0);
  });

  /** Nunca se retiene más que el pago: no existe un cobro negativo. */
  it("una comisión mayor que el pago se recorta al pago", () => {
    const r = withholdingForPayment({ paymentMinor: 100_00, ownFeeMinor: 500_00, pendingDebtMinor: 0 });
    expect(r.withholdMinor).toBe(100_00);
    expect(r.netMinor).toBe(0);
  });

  it("valores inválidos no producen retenciones fantasma", () => {
    const r = withholdingForPayment({ paymentMinor: -5, ownFeeMinor: 10, pendingDebtMinor: 10 });
    expect(r).toEqual({ withholdMinor: 0, appliedToDebtMinor: 0, remainingDebtMinor: 10, netMinor: 0 });
  });
});
