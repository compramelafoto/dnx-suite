import { describe, expect, it } from "vitest";
import type { CobroMp } from "@/lib/cash/mp-cobros";
import { candidatosDePago, notaDePagoVerificado } from "./verificar-pago";

const cobro = (id: string, montoMinor: number, hora: string, estado = "approved"): CobroMp => ({
  id,
  fecha: new Date(`2026-10-18T${hora}:00-03:00`),
  montoMinor,
  estado,
  medio: "Transferencia",
  pagador: `Pagador ${id}`,
  descripcion: null,
});

describe("candidatosDePago", () => {
  const cobros = [cobro("1", 700000, "10:00"), cobro("2", 700000, "10:30"), cobro("3", 700100, "10:31"), cobro("4", 700000, "10:40", "pending")];

  it("sólo acreditados, por el monto exacto, del más nuevo al más viejo", () => {
    expect(candidatosDePago(cobros, 700000, new Set()).map((c) => c.id)).toEqual(["2", "1"]);
  });

  it("descarta los ya usados", () => {
    expect(candidatosDePago(cobros, 700000, new Set(["2"])).map((c) => c.id)).toEqual(["1"]);
  });

  it("sin coincidencias, vacío", () => {
    expect(candidatosDePago(cobros, 123, new Set())).toEqual([]);
  });
});

describe("notaDePagoVerificado", () => {
  it("con y sin pagador", () => {
    expect(notaDePagoVerificado({ id: "99", pagador: "Ana" })).toBe("Verificado en Mercado Pago (operación 99, de Ana)");
    expect(notaDePagoVerificado({ id: "99", pagador: null })).toBe("Verificado en Mercado Pago (operación 99)");
  });
});
