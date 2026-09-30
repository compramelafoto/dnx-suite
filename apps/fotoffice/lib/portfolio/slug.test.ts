import { describe, expect, it } from "vitest";
import { derivePortfolioSlug } from "./slug";

const sinTomar = new Set<string>();

describe("derivePortfolioSlug", () => {
  it("nombre y apellido, en minúsculas y con guion", () => {
    expect(derivePortfolioSlug({ firstName: "Juan", lastName: "Pérez", taken: sinTomar })).toBe(
      "juan-perez",
    );
  });

  it("saca las tildes y la eñe", () => {
    expect(derivePortfolioSlug({ firstName: "Iñaki", lastName: "Muñoz", taken: sinTomar })).toBe(
      "inaki-munoz",
    );
  });

  it("un apellido compuesto queda con un solo guion por espacio", () => {
    expect(
      derivePortfolioSlug({ firstName: "María José", lastName: "De la Fuente", taken: sinTomar }),
    ).toBe("maria-jose-de-la-fuente");
  });

  it("desambigua con un sufijo cuando ya está tomado", () => {
    expect(
      derivePortfolioSlug({
        firstName: "Juan",
        lastName: "Pérez",
        taken: new Set(["juan-perez"]),
      }),
    ).toBe("juan-perez-2");
  });

  it("sigue subiendo el sufijo mientras siga tomado", () => {
    expect(
      derivePortfolioSlug({
        firstName: "Juan",
        lastName: "Pérez",
        taken: new Set(["juan-perez", "juan-perez-2", "juan-perez-3"]),
      }),
    ).toBe("juan-perez-4");
  });

  it("un nombre que no deja ninguna letra usable no rompe: cae en 'socio'", () => {
    expect(derivePortfolioSlug({ firstName: "***", lastName: "///", taken: sinTomar })).toBe(
      "socio",
    );
  });

  it("y ese caso degradado también desambigua", () => {
    expect(
      derivePortfolioSlug({ firstName: "***", lastName: "///", taken: new Set(["socio"]) }),
    ).toBe("socio-2");
  });

  it("los espacios de sobra no dejan guiones colgando", () => {
    expect(
      derivePortfolioSlug({ firstName: "  Juan  ", lastName: "  Pérez  ", taken: sinTomar }),
    ).toBe("juan-perez");
  });
});
