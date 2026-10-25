import { describe, expect, it } from "vitest";
import { aCobrarAhora, avisoCobroRepetido, diasEntre, reintentarSenaRepetida, PLAZO_SIN_REGLA_DIAS, repartirDescuento, senaSugerida, separarTicket, sugerirEntrega } from "./pedido-mostrador";

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

describe("separarTicket", () => {
  const conProceso = new Set(["copias"]);
  const linea = (id: string, productId: string | null, paraRetirar?: boolean) => ({ id, productId, paraRetirar });

  it("una línea con proceso va al pedido", () => {
    const r = separarTicket([linea("a", "copias")], conProceso);
    expect(r.delPedido.map((l) => l.id)).toEqual(["a"]);
    expect(r.enElMomento).toEqual([]);
  });
  it("una sin proceso marcada va al pedido", () => {
    const r = separarTicket([linea("a", "marco", true)], conProceso);
    expect(r.delPedido.map((l) => l.id)).toEqual(["a"]);
    expect(r.enElMomento).toEqual([]);
  });
  it("una sin proceso sin marcar va a la venta", () => {
    const r = separarTicket([linea("a", "marco"), linea("b", "marco", false)], conProceso);
    expect(r.delPedido).toEqual([]);
    expect(r.enElMomento.map((l) => l.id)).toEqual(["a", "b"]);
  });
  it("una a mano marcada va al pedido", () => {
    const r = separarTicket([linea("a", null, true), linea("b", null)], conProceso);
    expect(r.delPedido.map((l) => l.id)).toEqual(["a"]);
    expect(r.enElMomento.map((l) => l.id)).toEqual(["b"]);
  });
  it("una con proceso desmarcada igual va al pedido", () => {
    const r = separarTicket([linea("a", "copias", false)], conProceso);
    expect(r.delPedido.map((l) => l.id)).toEqual(["a"]);
  });
  it("respeta el orden del ticket en cada parte", () => {
    const r = separarTicket([linea("a", "marco", true), linea("b", "marco"), linea("c", "copias"), linea("d", null)], conProceso);
    expect(r.delPedido.map((l) => l.id)).toEqual(["a", "c"]);
    expect(r.enElMomento.map((l) => l.id)).toEqual(["b", "d"]);
  });
  it("el plazo de un producto sin regla es un día", () => {
    expect(PLAZO_SIN_REGLA_DIAS).toBe(1);
  });
});

describe("reintentarSenaRepetida", () => {
  it("reintenta si hay seña y el pedido no tiene ningún cobro (la primera vuelta se cortó)", () => {
    expect(reintentarSenaRepetida(500000, 0)).toBe(true);
  });
  it("no reintenta si el pedido ya tiene un cobro (el de esta clave u otro cargado a mano)", () => {
    expect(reintentarSenaRepetida(500000, 500000)).toBe(false);
    expect(reintentarSenaRepetida(500000, 100000)).toBe(false);
  });
  it("sin seña no hay nada que reintentar", () => {
    expect(reintentarSenaRepetida(0, 0)).toBe(false);
  });
});

describe("avisoCobroRepetido", () => {
  it("si no cambió nada, dice que no se volvió a cobrar", () => {
    expect(avisoCobroRepetido({ numero: "P-7", sena: { tipo: "sin-cambios" }, habiaVentaEnElMomento: false })).toBe(
      "Este cobro ya estaba registrado en el pedido P-7: no se volvió a cobrar.",
    );
  });
  it("si la seña se registró en esta vuelta, lo dice", () => {
    expect(avisoCobroRepetido({ numero: "P-7", sena: { tipo: "registrada" }, habiaVentaEnElMomento: false })).toContain("ahora sí");
  });
  it("si la seña falló, manda a cobrarla desde el pedido", () => {
    expect(avisoCobroRepetido({ numero: "P-7", sena: { tipo: "fallo", error: "Caja apagada" }, habiaVentaEnElMomento: false })).toBe(
      "El pedido P-7 quedó creado pero la seña no se registró (Caja apagada). Cobrala desde el pedido.",
    );
  });
  it("con venta en el momento, pide revisar si esa venta quedó hecha", () => {
    const aviso = avisoCobroRepetido({ numero: "P-7", sena: { tipo: "registrada" }, habiaVentaEnElMomento: true });
    expect(aviso).toContain("historial de ventas");
    expect(aviso).toContain("no se volvió a vender");
  });
});
