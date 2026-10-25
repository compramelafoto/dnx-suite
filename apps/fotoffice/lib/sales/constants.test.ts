import { describe, expect, it } from "vitest";
import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, STOCK_REASONS, STOCK_REASON_LABELS } from "./constants";

describe("motivos de stock", () => {
  it("incluye PEDIDO con su etiqueta", () => {
    expect(STOCK_REASONS).toContain("PEDIDO");
    expect(STOCK_REASON_LABELS.PEDIDO).toBe("Apartado para pedido");
  });

  it("incluye CONSUMO con su etiqueta", () => {
    expect(STOCK_REASONS).toContain("CONSUMO");
    expect(STOCK_REASON_LABELS.CONSUMO).toBe("Consumo");
  });

  it("tiene etiqueta para todos los motivos", () => {
    for (const motivo of STOCK_REASONS) expect(STOCK_REASON_LABELS[motivo]).toBeTruthy();
  });
});

describe("tipos de producto", () => {
  it("incluye INSUMO con su etiqueta", () => {
    expect(PRODUCT_KINDS).toContain("INSUMO");
    expect(PRODUCT_KIND_LABELS.INSUMO).toBe("Insumo");
  });
});
