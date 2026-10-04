import { describe, expect, it } from "vitest";
import { coordenadasLegibles, direccionDeLugar, enlaceDeMapa, type Lugar } from "./lugar";

function lugar(extra: Partial<Lugar> = {}): Lugar {
  return {
    latitude: -32.9468,
    longitude: -60.6393,
    displayName: "426, Ricchieri, Martin, Rosario, Santa Fe, S2000, Argentina",
    countryCode: "AR",
    countryName: "Argentina",
    province: "Santa Fe",
    city: "Rosario",
    address: "Ricchieri 426",
    postalCode: "S2000",
    locationName: null,
    placeId: "nominatim:1",
    precision: "ADDRESS",
    provider: "nominatim",
    ...extra,
  };
}

describe("la dirección que se escribe al elegir una sugerencia", () => {
  it("arma nombre del lugar, calle y localidad, en ese orden", () => {
    expect(direccionDeLugar(lugar({ locationName: "Club Social" }))).toBe(
      "Club Social, Ricchieri 426, Rosario",
    );
  });

  it("no repite una parte que Nominatim devolvió dos veces", () => {
    expect(
      direccionDeLugar(lugar({ locationName: "Ricchieri 426", address: "Ricchieri 426" })),
    ).toBe("Ricchieri 426, Rosario");
  });

  it("sin ninguna de las tres partes cae en el nombre completo, no en vacío", () => {
    expect(direccionDeLugar(lugar({ locationName: null, address: null, city: null }))).toBe(
      "426, Ricchieri, Martin, Rosario, Santa Fe, S2000, Argentina",
    );
  });
});

describe("cómo se muestra y se abre el punto", () => {
  it("seis decimales, que son unos once centímetros", () => {
    expect(coordenadasLegibles(-32.9468, -60.6393)).toBe("-32.946800, -60.639300");
  });

  it("el enlace abre la aplicación de mapas del teléfono", () => {
    expect(enlaceDeMapa(-32.9468, -60.6393)).toBe(
      "https://www.google.com/maps?q=-32.9468,-60.6393",
    );
  });
});
