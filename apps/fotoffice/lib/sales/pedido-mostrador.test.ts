import { describe, expect, it } from "vitest";
import { aCobrarAhora, diasEntre, repartirDescuento, senaSugerida, sugerirEntrega } from "./pedido-mostrador";

describe("sugerirEntrega", () => {
  it("suma los días", () => {
    // sábado 17/10/2026 + 7 = sábado 24/10
    expect(sugerirEntrega("2026-10-17", 7)).toBe("2026-10-24");
  });
  it("si cae domingo pasa al lunes", () => {
    // sábado 17/10 + 1 = domingo 18 → lunes 19
    expect(sugerirEntrega("2026-10-17", 1)).toBe("2026-10-19");
  });
  it("cero días es hoy", () => {
    expect(sugerirEntrega("2026-10-19", 0)).toBe("2026-10-19");
  });
});

describe("diasEntre", () => {
  it("cuenta días corridos y nunca da negativo", () => {
    expect(diasEntre("2026-10-18", "2026-10-25")).toBe(7);
    expect(diasEntre("2026-10-25", "2026-10-18")).toBe(0);
  });
});

describe("senaSugerida", () => {
  it("la mitad redondeada hacia arriba a $ 100", () => {
    expect(senaSugerida(3_270_000)).toBe(1_640_000); // $ 32.700 → $ 16.400
    expect(senaSugerida(2_400_000)).toBe(1_200_000);
  });
  it("nunca más que el total", () => {
    expect(senaSugerida(5_000)).toBe(5_000);
  });
});

describe("repartirDescuento", () => {
  it("en proporción a cada parte", () => {
    expect(repartirDescuento(7_500, 2_500, 1_000)).toEqual({ pedido: 750, venta: 250 });
  });
  it("sin descuento, nada", () => {
    expect(repartirDescuento(7_500, 2_500, 0)).toEqual({ pedido: 0, venta: 0 });
  });
});

describe("aCobrarAhora", () => {
  it("lo que se lleva más la seña", () => {
    expect(aCobrarAhora(1_000, 10_000, 4_000)).toBe(5_000);
  });
  it("sin seña se paga todo", () => {
    expect(aCobrarAhora(1_000, 10_000, null)).toBe(11_000);
  });
  it("una seña mayor al pedido se topea", () => {
    expect(aCobrarAhora(0, 10_000, 99_000)).toBe(10_000);
  });
});
