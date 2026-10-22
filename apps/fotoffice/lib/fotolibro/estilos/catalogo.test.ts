import { describe, expect, it } from "vitest";
import { ESTILOS, temasConEstilos } from "./catalogo";
import { problemasDeEstilos } from "./comprobar";

describe("catálogo de estilos de fotolibro", () => {
  it("cada temática tiene al menos 10 estilos", () => {
    for (const t of temasConEstilos()) expect(ESTILOS.filter((e) => e.tema === t.id).length, t.id).toBeGreaterThanOrEqual(10);
  });

  it("todos los estilos cumplen las reglas (dibujo, zona de fotos, títulos, tipografías)", () => {
    expect(problemasDeEstilos(ESTILOS)).toEqual([]);
  });
});
