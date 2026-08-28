import { describe, expect, it } from "vitest";
import { pickCategoryForScale } from "./category-for-scale";

const categorias = [
  { id: "prof", name: "Profesional" },
  { id: "est", name: "Estudiante" },
  { id: "afi", name: "Aficionado" },
  { id: "hon", name: "Honorario" },
];

describe("pickCategoryForScale", () => {
  it("la cuota plena corresponde a Profesional", () => {
    expect(pickCategoryForScale("PLENA", categorias)).toBe("prof");
  });

  it("la reducida corresponde a Estudiante", () => {
    expect(pickCategoryForScale("REDUCIDA", categorias)).toBe("est");
  });

  it("la exenta corresponde a Honorario", () => {
    expect(pickCategoryForScale("EXENTA", categorias)).toBe("hon");
  });

  it("no distingue mayúsculas ni acentos de más", () => {
    expect(pickCategoryForScale("PLENA", [{ id: "x", name: "PROFESIONAL" }])).toBe("x");
  });

  /**
   * Los nombres de categoría los define cada institución. Si ninguno coincide se devuelve
   * `null` y la ficha queda sin categoría, que es lo que pasaba antes: preferible a asignarle
   * una que signifique otra cosa.
   */
  it("sin una categoría que coincida devuelve null", () => {
    expect(pickCategoryForScale("PLENA", [{ id: "x", name: "Vitalicio" }])).toBeNull();
  });

  it("sin categorías cargadas devuelve null", () => {
    expect(pickCategoryForScale("PLENA", [])).toBeNull();
  });
});
