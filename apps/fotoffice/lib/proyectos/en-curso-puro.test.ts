import { describe, expect, it } from "vitest";
import { etapaSiguiente, faseDeEtapa, retenido, urgenciaDeEntrega } from "./en-curso-puro";

const e = (name: string, color = "", order = 1, esUltima = false) => ({ name, color, order, esUltima });

describe("faseDeEtapa", () => {
  it("manda el color de la etapa", () => {
    expect(faseDeEtapa(e("Enviado al laboratorio", "violeta"))).toBe("EN_PROVEEDOR");
    expect(faseDeEtapa(e("Listo para retirar", "amarillo"))).toBe("LISTO");
    expect(faseDeEtapa(e("Entregado", "verde"))).toBe("ENTREGADO");
  });

  it("sin color usa el nombre", () => {
    expect(faseDeEtapa(e("Enviar pedido", "x", 0))).toBe("EN_PROVEEDOR");
    expect(faseDeEtapa(e("Pedido listo para entregar"))).toBe("LISTO");
    expect(faseDeEtapa(e("Retirar de laboratorio"))).toBe("EN_PROVEEDOR");
    expect(faseDeEtapa(e("Edición"))).toBe("EN_PROCESO");
    expect(faseDeEtapa(e("Finalizado", "x", 5, true))).toBe("ENTREGADO");
    expect(faseDeEtapa(e("Esperar selección del cliente", "x", 0))).toBe("RECIBIDO");
  });
});

describe("urgenciaDeEntrega", () => {
  it("compara con hoy", () => {
    expect(urgenciaDeEntrega("2026-10-17", "2026-10-18")).toBe("VENCIDO");
    expect(urgenciaDeEntrega("2026-10-18", "2026-10-18")).toBe("HOY");
    expect(urgenciaDeEntrega("2026-10-20", "2026-10-18")).toBe("PRONTO");
    expect(urgenciaDeEntrega("2026-10-28", "2026-10-18")).toBe("OK");
    expect(urgenciaDeEntrega(null, "2026-10-18")).toBe("SIN_FECHA");
  });
});

describe("etapaSiguiente", () => {
  const etapas = [
    { id: "b", name: "Enviado", color: "", order: 1 },
    { id: "a", name: "Recibido", color: "", order: 0 },
    { id: "c", name: "Listo", color: "", order: 2 },
  ];
  it("sigue el orden, no la posición en la lista", () => {
    expect(etapaSiguiente(etapas, "a")?.id).toBe("b");
    expect(etapaSiguiente(etapas, "b")?.id).toBe("c");
  });
  it("en la última no hay siguiente", () => {
    expect(etapaSiguiente(etapas, "c")).toBeNull();
  });
});

describe("retenido", () => {
  it("está retenido en Listo para retirar con saldo", () => {
    expect(retenido({ fase: "LISTO", pedido: { saldoMinor: 500000 } })).toBe(true);
  });
  it("no lo está si no debe nada", () => {
    expect(retenido({ fase: "LISTO", pedido: { saldoMinor: 0 } })).toBe(false);
  });
  it("no lo está en otra fase aunque deba", () => {
    expect(retenido({ fase: "EN_PROCESO", pedido: { saldoMinor: 500000 } })).toBe(false);
  });
  it("no lo está sin pedido", () => {
    expect(retenido({ fase: "LISTO", pedido: null })).toBe(false);
  });
});
