import { describe, expect, it } from "vitest";
import { mensajeCandado, saldoPedidoMinor } from "./candado-saldo-puro";

describe("saldoPedidoMinor", () => {
  it("es el total menos lo cobrado, en centavos", () => {
    expect(saldoPedidoMinor({ totalArs: 10000, cobradoArs: 5000, status: "CONFIRMADO" })).toBe(500000);
  });

  it("un pedido cancelado no debe nada", () => {
    expect(saldoPedidoMinor({ totalArs: 10000, cobradoArs: 5000, status: "CANCELADO" })).toBe(0);
  });

  it("cobrado de más no da saldo negativo", () => {
    expect(saldoPedidoMinor({ totalArs: 10000, cobradoArs: 12000, status: "CONFIRMADO" })).toBe(0);
  });

  it("redondea los centavos sin arrastrar el error del flotante", () => {
    expect(saldoPedidoMinor({ totalArs: 0.3, cobradoArs: 0.1, status: "CONFIRMADO" })).toBe(20);
  });
});

describe("mensajeCandado", () => {
  it("nombra el pedido y el saldo, sin los ,00", () => {
    expect(mensajeCandado("P-12", 500000)).toBe("El pedido P-12 debe $ 5.000. Cobrá el saldo antes de entregar.");
  });

  it("con centavos los muestra", () => {
    expect(mensajeCandado("P-12", 500050)).toBe("El pedido P-12 debe $ 5.000,50. Cobrá el saldo antes de entregar.");
  });
});
