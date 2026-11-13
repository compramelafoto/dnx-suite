import { describe, expect, it } from "vitest";
import { leerValorRegla } from "./formulario";

const g = (datos: Record<string, string>) => (n: string) => datos[n] ?? "";
const T = [{ clave: "T1", nombre: "1.er trimestre" }, { clave: "T2", nombre: "2.º trimestre" }, { clave: "T3", nombre: "3.er trimestre" }];

describe("leerValorRegla", () => {
  it("números con coma y sin límite", () => {
    expect(leerValorRegla("notaAprobacion", g({ valor: "6,5" }), { periodos: T })).toEqual({ ok: true, valor: 6.5 });
    expect(leerValorRegla("limiteFaltas", g({ valor: "" }), { periodos: T })).toEqual({ ok: true, valor: null });
    expect(leerValorRegla("faltaPorTarde", g({ valor: "2" }), { periodos: T }).ok).toBe(false);
  });

  it("pesos", () => {
    expect(leerValorRegla("pesos", g({ peso_examen: "50", peso_trabajos: "30", peso_carpeta: "10", peso_participacion: "10" }), { periodos: T })).toEqual({
      ok: true,
      valor: { examen: 50, trabajos: 30, carpeta: 10, participacion: 10 },
    });
    expect(leerValorRegla("pesos", g({}), { periodos: T }).ok).toBe(false);
  });

  it("períodos: respeta claves, quita y agrega uno nuevo con clave libre", () => {
    const r = leerValorRegla(
      "periodos",
      g({
        periodo_0_clave: "T1", periodo_0_nombre: "1.er trimestre", periodo_0_desde: "2027-03-01",
        periodo_1_clave: "T2", periodo_1_nombre: "2.º", periodo_1_quitar: "on",
        periodo_2_clave: "T3", periodo_2_nombre: "3.er trimestre",
        periodo_nuevo_nombre: "Diciembre",
      }),
      { periodos: T },
    );
    expect(r.ok && (r.valor as { clave: string }[]).map((p) => p.clave)).toEqual(["T1", "T3", "P4"]);
  });
});
