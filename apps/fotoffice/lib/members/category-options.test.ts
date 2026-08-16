import { describe, expect, it } from "vitest";
import { resolveCategoryOptionsForEdit } from "./category-options";

describe("resolveCategoryOptionsForEdit — L: categoría desactivada conserva socio", () => {
  const active = [
    { id: "cat-1", name: "Socio activo" },
    { id: "cat-2", name: "Estudiante" },
  ];

  it("si la categoría actual ya está entre las activas, no duplica nada", () => {
    const result = resolveCategoryOptionsForEdit(active, "cat-1", active[0]);
    expect(result).toHaveLength(2);
  });

  it("si la categoría actual está desactivada, se agrega igual para no perderla al guardar", () => {
    const inactive = { id: "cat-3", name: "Honorario (desactivada)" };
    const result = resolveCategoryOptionsForEdit(active, "cat-3", inactive);
    expect(result.map((c) => c.id)).toEqual(["cat-1", "cat-2", "cat-3"]);
  });

  it("un socio sin categoría no agrega nada extra", () => {
    const result = resolveCategoryOptionsForEdit(active, null, null);
    expect(result).toHaveLength(2);
  });

  it("no muta el array de categorías activas recibido", () => {
    const inactive = { id: "cat-3", name: "Honorario" };
    resolveCategoryOptionsForEdit(active, "cat-3", inactive);
    expect(active).toHaveLength(2);
  });
});
