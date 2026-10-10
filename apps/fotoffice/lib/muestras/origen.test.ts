import { describe, expect, it } from "vitest";
import { candidatosDeOrigen, nombreDeLugar, textoDeLugar } from "./origen";

describe("textoDeLugar", () => {
  it("arma ciudad, provincia y país", () => expect(textoDeLugar("Rosario", "Santa Fe")).toBe("Rosario, Santa Fe, Argentina"));
  it("sin provincia", () => expect(textoDeLugar("  Rosario ", "")).toBe("Rosario, Argentina"));
  it("colapsa espacios", () => expect(textoDeLugar("Villa  Gobernador   Gálvez", null)).toBe("Villa Gobernador Gálvez, Argentina"));
  it("sin ciudad no hay lugar", () => {
    expect(textoDeLugar(null, "Santa Fe")).toBeNull();
    expect(textoDeLugar("   ", "Santa Fe")).toBeNull();
    expect(textoDeLugar("R", "Santa Fe")).toBeNull();
  });
});

describe("candidatosDeOrigen", () => {
  const sfpr = { city: "Rosario", province: "Santa Fe" };

  it("socio con provincia y después la institución", () => {
    expect(candidatosDeOrigen({ city: "Funes", province: "Santa Fe" }, sfpr)).toEqual([
      "Funes, Santa Fe, Argentina",
      "Rosario, Santa Fe, Argentina",
    ]);
  });

  it("socio sin provincia: le presta la de la institución y prueba la ciudad sola", () => {
    expect(candidatosDeOrigen({ city: "Funes", province: null }, sfpr)).toEqual([
      "Funes, Santa Fe, Argentina",
      "Funes, Argentina",
      "Rosario, Santa Fe, Argentina",
    ]);
  });

  it("no repite cuando el socio vive en la ciudad de la institución", () => {
    expect(candidatosDeOrigen({ city: "rosario", province: "santa fe" }, sfpr)).toEqual(["rosario, santa fe, Argentina"]);
  });

  it("socio sin ciudad: sólo la institución", () => {
    expect(candidatosDeOrigen({ city: "", province: "Santa Fe" }, sfpr)).toEqual(["Rosario, Santa Fe, Argentina"]);
  });

  it("nadie tiene ciudad: lista vacía", () => {
    expect(candidatosDeOrigen({ city: null }, { city: null, province: null })).toEqual([]);
    expect(candidatosDeOrigen({ city: null }, null)).toEqual([]);
  });
});

describe("nombreDeLugar", () => {
  it("se queda con la ciudad", () => expect(nombreDeLugar("Rosario, Santa Fe, Argentina")).toBe("Rosario"));
});
