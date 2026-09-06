import { describe, expect, it } from "vitest";
import { toPaymentHistory } from "./payment-entries";
import { historicalMethod } from "./payment-method";

function fila(over: Partial<Parameters<typeof toPaymentHistory>[0][number]> = {}) {
  return {
    id: "p1",
    amountArs: "15000.00",
    method: null,
    providerPaymentRef: null,
    providerOrderRef: null,
    paidAt: new Date("2026-09-01T10:00:00Z"),
    createdAt: new Date("2026-09-01T10:00:00Z"),
    allocations: [],
    ...over,
  };
}

describe("toPaymentHistory", () => {
  it("pasa los importes a centavos enteros", () => {
    const [e] = toPaymentHistory([fila({ amountArs: "15000.50" })]);
    expect(e?.amountMinor).toBe(1500050);
  });

  it("ordena del más reciente al más viejo", () => {
    const salida = toPaymentHistory([
      fila({ id: "viejo", paidAt: new Date("2024-01-10T00:00:00Z") }),
      fila({ id: "nuevo", paidAt: new Date("2026-08-10T00:00:00Z") }),
      fila({ id: "medio", paidAt: new Date("2025-05-10T00:00:00Z") }),
    ]);
    expect(salida.map((e) => e.id)).toEqual(["nuevo", "medio", "viejo"]);
  });

  it("usa la fecha de creación sólo cuando el pago no tiene fecha propia", () => {
    const [e] = toPaymentHistory([
      fila({ paidAt: null, createdAt: new Date("2026-07-04T00:00:00Z") }),
    ]);
    expect(e?.paidAt).toEqual(new Date("2026-07-04T00:00:00Z"));
  });

  it("nombra los períodos imputados en palabras del socio", () => {
    const [e] = toPaymentHistory([
      fila({ allocations: [{ charge: { period: "2026-09" } }] }),
    ]);
    expect(e?.appliedTo).toEqual(["septiembre de 2026"]);
  });

  it("no repite el mes cuando un pago canceló dos cargos del mismo período", () => {
    const [e] = toPaymentHistory([
      fila({
        allocations: [{ charge: { period: "2026-09" } }, { charge: { period: "2026-09" } }],
      }),
    ]);
    expect(e?.appliedTo).toEqual(["septiembre de 2026"]);
  });

  it("al saldo migrado no lo llama cuota: usa su propio rótulo", () => {
    const [e] = toPaymentHistory([
      fila({ allocations: [{ charge: { period: "APERTURA" } }] }),
    ]);
    expect(e?.appliedTo).toEqual(["Deuda anterior al sistema"]);
    expect(e?.appliedTo[0]).not.toContain("APERTURA");
  });

  it("reconoce el pago histórico y lo muestra sin el prefijo técnico", () => {
    const [e] = toPaymentHistory([fila({ method: historicalMethod("EFECTIVO") })]);
    expect(e?.historical).toBe(true);
    expect(e?.methodLabel).toBe("Efectivo");
  });

  it("un pago de Mercado Pago no se confunde con uno histórico", () => {
    const [e] = toPaymentHistory([fila({ providerPaymentRef: "mp-123" })]);
    expect(e?.historical).toBe(false);
    expect(e?.methodLabel).toBe("Mercado Pago");
  });

  it("un histórico no muestra imputación: se carga sin tocar ninguna cuota", () => {
    const [e] = toPaymentHistory([
      fila({ method: historicalMethod("TRANSFERENCIA"), allocations: [] }),
    ]);
    expect(e?.appliedTo).toEqual([]);
  });
});
