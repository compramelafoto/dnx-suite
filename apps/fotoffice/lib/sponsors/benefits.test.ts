import { describe, expect, it } from "vitest";
import { compararPorMarca, tieneBeneficio } from "./benefits";

describe("beneficios del portal", () => {
  it("un sponsor sin título ni texto no es un beneficio", () => {
    expect(tieneBeneficio({ title: null, description: null })).toBe(false);
    expect(tieneBeneficio({ title: "   ", description: "\n" })).toBe(false);
  });

  it("alcanza con el título o con el texto", () => {
    expect(tieneBeneficio({ title: "15% para socios", description: null })).toBe(true);
    expect(tieneBeneficio({ title: null, description: "Mostrando el carnet" })).toBe(true);
  });

  it("ordena por marca sin importar mayúsculas ni tildes", () => {
    const marcas = [{ name: "Óptica Sur" }, { name: "casa foto" }, { name: "Afga" }];
    expect([...marcas].sort(compararPorMarca).map((m) => m.name)).toEqual(["Afga", "casa foto", "Óptica Sur"]);
  });
});
