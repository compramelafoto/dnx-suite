import { describe, expect, it } from "vitest";
import { guiaDeAtencion, situacionDeAtencion } from "./guia";

describe("guía del bot de atención", () => {
  it("nombra las tres herramientas y las reglas que no se negocian", () => {
    const g = guiaDeAtencion();
    for (const t of ["buscar_productos", "datos_del_estudio", "preparar_presupuesto", "pasar_a_persona"]) expect(g).toContain(t);
    expect(g).toMatch(/Nunca inventes precios/);
    expect(g).toMatch(/markdown/);
  });

  it("la situación dice el día y la hora en Argentina y el nombre si lo hay", () => {
    const s = situacionDeAtencion({ estudio: "DNX Estudio", cliente: "Lucía", ahora: new Date("2026-10-20T23:30:00.000Z") });
    expect(s).toContain("DNX Estudio");
    expect(s).toMatch(/martes, 20 de octubre/);
    expect(s).toContain("20:30");
    expect(s).toContain("Lucía");
    expect(situacionDeAtencion({ estudio: "X", cliente: null, ahora: new Date() })).toContain("No sabemos el nombre");
  });
});
