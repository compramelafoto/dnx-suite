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
