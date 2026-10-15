import { describe, expect, it } from "vitest";
import {
  MAX_ANOTACIONES,
  fusionarParches,
  leerAnotaciones,
  loAnotado,
  parcheDelBorrador,
  rubrosSinDatos,
  sumarAnotacion,
  type Anotacion,
} from "./borrador";
import { perfilBase } from "./motor";

const T = (min: number) => new Date(Date.UTC(2026, 9, 13, 7, min)).toISOString();

describe("fusionarParches", () => {
  it("lo nuevo pisa lo viejo, campo por campo; lo que no se repite queda", () => {
    const f = fusionarParches(
      { viveSoloDeFotografia: "si", negocio: { software: "20000", publicidad: "10000" }, ahorro: "1" },
      { negocio: { software: "30000" }, fondoEmergencia: "5" },
    );
    expect(f).toEqual({ viveSoloDeFotografia: "si", negocio: { software: "30000", publicidad: "10000" }, ahorro: "1", fondoEmergencia: "5" });
  });
  it("gastos: por renglón (rubro + renglón, o rubro + etiqueta sin mayúsculas); corregir uno no borra los otros", () => {
    const f = fusionarParches(
      {
        gastosPersonales: [
          { grupoId: "housing", itemId: "rent-mortgage", monto: "450000" },
          { grupoId: "other", etiqueta: "Club", monto: "10000" },
        ],
      },
      {
        gastosPersonales: [
          { grupoId: "housing", itemId: "rent-mortgage", monto: "500000" },
          { grupoId: "other", etiqueta: "club ", monto: "12000" },
          { grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } },
        ],
      },
    );
    expect(f.gastosPersonales).toEqual([
      { grupoId: "housing", itemId: "rent-mortgage", monto: "500000" },
      { grupoId: "other", etiqueta: "club ", monto: "12000" },
      { grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } },
    ]);
  });
  it("la distribución de horas se reemplaza entera (siempre van las seis tareas)", () => {
    const f = fusionarParches(
      { distribucion: { unidad: "horas", coberturas: "10", edicion: "10" } },
      { distribucion: { unidad: "porcentaje", coberturas: "50" } },
    );
    expect(f.distribucion).toEqual({ unidad: "porcentaje", coberturas: "50" });
  });
});

describe("anotaciones", () => {
  const a: Anotacion[] = [
    { en: T(0), parche: { viveSoloDeFotografia: "si" } },
    { en: T(5), parche: { gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "450000" }] } },
    { en: T(9), parche: { gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "480000" }] } },
  ];
  it("el borrador es la fusión en orden; con `hasta`, sólo lo anotado antes de ese momento", () => {
    expect(parcheDelBorrador(a).gastosPersonales).toEqual([{ grupoId: "housing", itemId: "rent-mortgage", monto: "480000" }]);
    expect(parcheDelBorrador(a, new Date(T(6)))).toEqual({
      viveSoloDeFotografia: "si",
      gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "450000" }],
    });
    expect(parcheDelBorrador(a, new Date(T(0)))).toEqual({});
  });
  it("leerAnotaciones descarta lo que no es un parche válido (la base puede traer cualquier cosa)", () => {
    expect(leerAnotaciones(null)).toEqual([]);
    expect(leerAnotaciones({ anotaciones: "x" })).toEqual([]);
    expect(leerAnotaciones({ anotaciones: [{ en: T(1), parche: { ahorro: "$1" } }, { en: "no-fecha", parche: {} }, a[0]] })).toEqual([a[0]]);
  });
  it("sumarAnotacion agrega al final y, pasado el máximo, compacta las más viejas en una sola", () => {
    expect(sumarAnotacion(a, { ahorro: "1" }, new Date(T(10)))).toHaveLength(4);
    let muchas: Anotacion[] = [];
    for (let i = 0; i < MAX_ANOTACIONES + 5; i++) muchas = sumarAnotacion(muchas, { ahorro: String(i) }, new Date(Date.UTC(2026, 9, 13, 8, 0, i)));
    expect(muchas.length).toBeLessThanOrEqual(MAX_ANOTACIONES);
    expect(parcheDelBorrador(muchas).ahorro).toBe(String(MAX_ANOTACIONES + 4));
  });
});

describe("lo que se ve del borrador (sin montos)", () => {
  it("loAnotado nombra lo que ya contó, por rubro y renglón", () => {
    const l = loAnotado(
      {
        viveSoloDeFotografia: "si",
        gastosPersonales: [
          { grupoId: "housing", itemId: "rent-mortgage", monto: "450000" },
          { grupoId: "food", itemId: "supermarket", monto: "350000" },
          { grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } },
        ],
        negocio: { software: "30000" },
        horasSemana: "40",
      },
      perfilBase(null),
    );
    expect(l.join(" | ")).toMatch(/fotograf/);
    expect(l.join(" | ")).toMatch(/Vivienda.*Alquiler/);
    expect(l.join(" | ")).toMatch(/Alimentaci/);
    expect(l.join(" | ")).toMatch(/Mascotas/);
    expect(l.join(" | ")).toMatch(/software/i);
    expect(l.join(" | ")).toMatch(/horas por semana/);
    expect(l.join(" | ")).not.toMatch(/\d{3}/);
  });
  it("rubrosSinDatos: los rubros sin ningún monto, ni guardado ni anotado", () => {
    const r = rubrosSinDatos({ gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "1" }] }, perfilBase(null));
    expect(r).not.toContain("Vivienda");
    expect(r.length).toBe(perfilBase(null).personalExpenseGroups.length - 1);
  });
});

describe("cobros en el borrador (etapa A)", () => {
  it("se fusionan campo por campo y se nombran sin montos", () => {
    const p = fusionarParches({ cobros: { sena: "30" } }, { cobros: { ingresosBrutos: "3" } });
    expect(p.cobros).toEqual({ sena: "30", ingresosBrutos: "3" });
    expect(loAnotado(p, perfilBase(null))).toEqual(expect.arrayContaining(["seña", "ingresos brutos"]));
  });
});
