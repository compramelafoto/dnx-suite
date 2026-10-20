import { describe, expect, it } from "vitest";
import { pasoDelPedido } from "./seguimiento";

describe("pasoDelPedido", () => {
  it("pagado sin enviar sigue en Recibido", () => {
    expect(pasoDelPedido("PAGADO", [])).toBe("RECIBIDO");
    expect(pasoDelPedido("PAGADO_SIN_ENVIAR", ["RECIBIDO"])).toBe("RECIBIDO");
  });
  it("enviado es En el laboratorio", () => {
    expect(pasoDelPedido("ENVIADO", ["EN_PROVEEDOR"])).toBe("EN_LABORATORIO");
  });
  it("con dos trabajos manda el más atrasado", () => {
    expect(pasoDelPedido("ENVIADO", ["LISTO", "EN_PROVEEDOR"])).toBe("EN_LABORATORIO");
    expect(pasoDelPedido("ENVIADO", ["LISTO", "LISTO"])).toBe("LISTO");
    expect(pasoDelPedido("ENVIADO", ["ENTREGADO", "ENTREGADO"])).toBe("ENTREGADO");
  });
});
