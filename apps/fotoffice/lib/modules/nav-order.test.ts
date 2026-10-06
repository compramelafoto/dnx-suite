import { describe, expect, it } from "vitest";
import { ordenarSecciones } from "./nav-order";
import { ordenDeFamilias } from "./suggested";
import { getModuleDefinition } from "./registry";

type S = { id: string; moduleKey: string | null };
const secciones: S[] = [
  { id: "inicio", moduleKey: null },
  { id: "members", moduleKey: "members" },
  { id: "raffles", moduleKey: "raffles" },
  { id: "coverages", moduleKey: "coverages" },
  { id: "courses-sales", moduleKey: "courses-sales" },
  { id: "bookings", moduleKey: "bookings" },
  { id: "institucion", moduleKey: null },
  { id: "plataforma", moduleKey: null },
];
const ids = (l: S[]) => l.map((s) => s.id);

describe("ordenarSecciones", () => {
  it("sin tipo conserva el orden original", () => {
    expect(ids(ordenarSecciones(secciones, null))).toEqual(ids(secciones));
  });

  it("sociedad: institución, espacios, formación y al final coberturas", () => {
    expect(ids(ordenarSecciones(secciones, "sociedad"))).toEqual([
      "inicio", "members", "raffles", "bookings", "courses-sales", "coverages", "institucion", "plataforma",
    ]);
  });

  it("estudio: negocio, base, espacios, formación, institución, coberturas", () => {
    expect(ids(ordenarSecciones(secciones, "estudio"))).toEqual([
      "inicio", "bookings", "courses-sales", "members", "raffles", "coverages", "institucion", "plataforma",
    ]);
  });

  it("respeta el orden de familias y deja Inicio primero e Institución/Plataforma al final", () => {
    for (const tipo of ["freelance", "escuela", "ong", "espacio", "agrupacion", "local"]) {
      const orden = ordenDeFamilias(tipo);
      const res = ordenarSecciones(secciones, tipo);
      expect(res[0].id).toBe("inicio");
      expect(ids(res).slice(-2)).toEqual(["institucion", "plataforma"]);
      const pos = res
        .filter((s) => s.moduleKey)
        .map((s) => orden.indexOf(getModuleDefinition(s.moduleKey!)!.family));
      expect(pos).toEqual([...pos].sort((a, b) => a - b));
    }
  });

  it("no muta la entrada y un módulo desconocido va al final de los módulos", () => {
    const entrada: S[] = [
      { id: "inicio", moduleKey: null },
      { id: "raro", moduleKey: "no-existe" },
      { id: "bookings", moduleKey: "bookings" },
    ];
    const copia = [...entrada];
    expect(ids(ordenarSecciones(entrada, "sociedad"))).toEqual(["inicio", "bookings", "raro"]);
    expect(entrada).toEqual(copia);
  });
});
