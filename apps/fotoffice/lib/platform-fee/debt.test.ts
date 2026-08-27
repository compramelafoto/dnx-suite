import { describe, expect, it } from "vitest";
import { accrualForManualPayment, chargeAccruesFee, withholdingForPayment } from "./debt";

const DESDE = "2026-09";

describe("chargeAccruesFee", () => {
  it("las cuotas desde el período de corte devengan fee", () => {
    expect(chargeAccruesFee("2026-09", DESDE)).toBe(true);
    expect(chargeAccruesFee("2026-10", DESDE)).toBe(true);
    expect(chargeAccruesFee("2027-01", DESDE)).toBe(true);
  });

  it("las cuotas anteriores al corte no devengan fee", () => {
    expect(chargeAccruesFee("2026-08", DESDE)).toBe(false);
    expect(chargeAccruesFee("2025-12", DESDE)).toBe(false);
  });

  /**
   * El cargo de apertura son los $1.868.500 traídos del sistema anterior. Cobrar comisión
   * sobre esa deuda sería cobrar por trabajo que FotoOffice no hizo.
   */
  it("el cargo de apertura nunca devenga fee", () => {
    expect(chargeAccruesFee("APERTURA", DESDE)).toBe(false);
  });

  it("un período con formato raro no devenga: ante la duda, no se cobra", () => {
    expect(chargeAccruesFee("", DESDE)).toBe(false);
    expect(chargeAccruesFee("septiembre", DESDE)).toBe(false);
  });
});

describe("accrualForManualPayment", () => {
  it("devenga solo sobre lo imputado a cuotas que cobran fee", () => {
    const r = accrualForManualPayment(
      [
        { period: "APERTURA", amountMinor: 5_000_00 },
        { period: "2026-09", amountMinor: 8_000_00 },
      ],
      500,
      DESDE,
    );
    expect(r).toBe(400_00); // 5% de 8.000, nada sobre la apertura
  });

  it("un pago que solo salda deuda vieja no devenga nada", () => {
    expect(
      accrualForManualPayment([{ period: "APERTURA", amountMinor: 73_000_00 }], 500, DESDE),
    ).toBe(0);
  });

  it("suma el fee de varias cuotas que sí cobran", () => {
    const r = accrualForManualPayment(
      [
        { period: "2026-09", amountMinor: 8_000_00 },
        { period: "2026-10", amountMinor: 8_000_00 },
      ],
      500,
      DESDE,
    );
    expect(r).toBe(800_00);
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
