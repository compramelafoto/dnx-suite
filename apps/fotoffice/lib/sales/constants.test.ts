import { describe, expect, it } from "vitest";
import { STOCK_REASONS, STOCK_REASON_LABELS } from "./constants";

describe("motivos de stock", () => {
  it("incluye PEDIDO con su etiqueta", () => {
    expect(STOCK_REASONS).toContain("PEDIDO");
    expect(STOCK_REASON_LABELS.PEDIDO).toBe("Apartado para pedido");
  });

  it("tiene etiqueta para todos los motivos", () => {
    for (const motivo of STOCK_REASONS) expect(STOCK_REASON_LABELS[motivo]).toBeTruthy();
  });
});
