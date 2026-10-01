import { describe, expect, it } from "vitest";
import { buildReversal } from "./reverse";

const ingreso = {
  id: "mov-1",
  kind: "INGRESO" as const,
  amountMinor: 1_000_00,
  accountId: "acc-1",
  categoryId: "cat-1",
  paymentMethod: "EFECTIVO",
  clientId: "cli-1",
  description: "Venta de trípode",
  alreadyReversed: false,
  transferId: null,
};

describe("buildReversal", () => {
  it("el contramovimiento de un ingreso es un egreso por el mismo importe", () => {
    const r = buildReversal(ingreso, "Se devolvió el producto");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.kind).toBe("EGRESO");
    expect(r.values.amountMinor).toBe(1_000_00);
  });

  it("el contramovimiento de un egreso es un ingreso", () => {
    const r = buildReversal({ ...ingreso, kind: "EGRESO" }, "Cargado dos veces");
    expect(r.ok && r.values.kind).toBe("INGRESO");
  });

  it("conserva cuenta, categoría, cliente y medio de pago del original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    if (!r.ok) throw new Error("debería anular");
    expect(r.values.accountId).toBe("acc-1");
    expect(r.values.categoryId).toBe("cat-1");
    expect(r.values.clientId).toBe("cli-1");
    expect(r.values.paymentMethod).toBe("EFECTIVO");
  });

  it("la descripción dice que es una anulación y arrastra la original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.description).toBe("Anulación de: Venta de trípode");
  });

  it("apunta al movimiento original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.reversesMovementId).toBe("mov-1");
  });

  it("el contramovimiento se carga a mano aunque el original viniera de otro módulo", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.sourceModule).toBe("manual");
    expect(r.ok && r.values.sourceRef).toBeNull();
  });

  it("sin motivo no se anula: una anulación sin explicación no se entiende meses después", () => {
    expect(buildReversal(ingreso, "   ")).toEqual({
      ok: false,
      error: "Escribí por qué se anula el movimiento.",
    });
  });

  it("un movimiento ya anulado no se anula dos veces", () => {
    expect(buildReversal({ ...ingreso, alreadyReversed: true }, "Otra vez")).toEqual({
      ok: false,
      error: "Ese movimiento ya está anulado.",
    });
  });

  it("el contramovimiento de un asiento sin pase no queda marcado como pase", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.transferId).toBeNull();
  });

  describe("una pata de un pase no se anula sola", () => {
    const pata = { ...ingreso, transferId: "transfer-1" };

    it("se rechaza aunque tenga motivo y no esté anulada todavía", () => {
      expect(buildReversal(pata, "Me equivoqué de cuenta")).toEqual({
        ok: false,
        error: "Ese movimiento es parte de un pase entre cuentas. Para deshacerlo, hacé el pase inverso.",
      });
    });

    it("se rechaza incluso sin motivo: el chequeo de pase corta antes que el del motivo vacío", () => {
      expect(buildReversal(pata, "")).toEqual({
        ok: false,
        error: "Ese movimiento es parte de un pase entre cuentas. Para deshacerlo, hacé el pase inverso.",
      });
    });

    it("no crea plata de la nada: la única salida es NO generar el contramovimiento", () => {
      // Si esto alguna vez devolviera ok:true, un pase de $27.300 podría anularse por una
      // sola pata y dejar un ingreso o egreso suelto sin `transferId` — el error que el
      // diseño llama el más caro del módulo (§6.2.1).
      const r = buildReversal(pata, "Motivo cualquiera");
      expect(r.ok).toBe(false);
    });
  });
});
