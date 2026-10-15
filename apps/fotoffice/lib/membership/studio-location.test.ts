import { describe, expect, it } from "vitest";
import {
  coordsDesdeGoogleMaps,
  direccionEnUnaLinea,
  enlaceAlMapa,
  parseStudioLocation,
  sonCoordenadasValidas,
  tieneUbicacionPublicable,
} from "./studio-location";

describe("coordsDesdeGoogleMaps", () => {
  it("lee el centro del mapa de un enlace copiado del navegador", () => {
    expect(coordsDesdeGoogleMaps("https://www.google.com/maps/@-32.9174,-60.6505,17z")).toEqual({
      lat: -32.9174,
      lng: -60.6505,
    });
  });

  it("prefiere el punto del lugar (!3d!4d) antes que el centro de la pantalla (@)", () => {
    // El `@` es donde quedó centrado el mapa; el `!3d!4d` es el local. Pueden no coincidir.
    const url =
      "https://www.google.com/maps/place/DNX/@-32.9000,-60.6000,17z/data=!3m1!4b1!4m6!3d-32.9174!4d-60.6505";
    expect(coordsDesdeGoogleMaps(url)).toEqual({ lat: -32.9174, lng: -60.6505 });
  });

  it("lee un enlace de compartir ubicación", () => {
    expect(coordsDesdeGoogleMaps("https://maps.google.com/?q=-32.9174,-60.6505")).toEqual({
      lat: -32.9174,
      lng: -60.6505,
    });
  });

  it("lee la coma escapada que a veces mete el navegador", () => {
    expect(coordsDesdeGoogleMaps("https://maps.google.com/?q=-32.9174%2C-60.6505")).toEqual({
      lat: -32.9174,
      lng: -60.6505,
    });
  });

  it("acepta las coordenadas pegadas a mano", () => {
    expect(coordsDesdeGoogleMaps("-32.9174, -60.6505")).toEqual({ lat: -32.9174, lng: -60.6505 });
    expect(coordsDesdeGoogleMaps("-32.9174,-60.6505")).toEqual({ lat: -32.9174, lng: -60.6505 });
  });

  it("un acortador no trae la ubicación adentro", () => {
    expect(coordsDesdeGoogleMaps("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
  });

  it("texto que no es una ubicación devuelve null", () => {
    expect(coordsDesdeGoogleMaps("San José 1672 Local 5, Funes")).toBeNull();
    expect(coordsDesdeGoogleMaps("")).toBeNull();
  });

  it("descarta coordenadas fuera del planeta", () => {
    expect(coordsDesdeGoogleMaps("-200, 500")).toBeNull();
    expect(coordsDesdeGoogleMaps("95, 10")).toBeNull();
  });

  it("descarta (0, 0), que siempre es un error de carga", () => {
    expect(coordsDesdeGoogleMaps("0, 0")).toBeNull();
  });
});

describe("sonCoordenadasValidas", () => {
  it("acepta un punto real de Funes", () => {
    expect(sonCoordenadasValidas(-32.9174, -60.6505)).toBe(true);
  });

  it("rechaza los bordes imposibles y los no-números", () => {
    expect(sonCoordenadasValidas(91, 0)).toBe(false);
    expect(sonCoordenadasValidas(0, 181)).toBe(false);
    expect(sonCoordenadasValidas(Number.NaN, 0)).toBe(false);
  });
});

describe("parseStudioLocation", () => {
  it("un estudio completo se guarda normalizado", () => {
    const r = parseStudioLocation({
      street: "  San José   1672 Local 5 ",
      city: "Funes",
      province: "Santa Fe",
      postalCode: "2132",
      mapsUrlOrCoords: "https://www.google.com/maps/@-32.9174,-60.6505,17z",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({
      studioStreet: "San José 1672 Local 5",
      studioCity: "Funes",
      studioProvince: "Santa Fe",
      studioPostalCode: "2132",
      studioLat: -32.9174,
      studioLng: -60.6505,
    });
  });

  it("todo vacío es válido: hay fotógrafos que trabajan a domicilio", () => {
    const r = parseStudioLocation({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.studioStreet).toBeNull();
    expect(r.data.studioLat).toBeNull();
  });

  it("una dirección sin enlace se guarda igual, sin coordenadas", () => {
    const r = parseStudioLocation({ street: "San José 1672", city: "Funes" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.studioCity).toBe("Funes");
    expect(r.data.studioLat).toBeNull();
  });

  it("un enlace que no se puede leer se avisa, no se traga en silencio", () => {
    const r = parseStudioLocation({ mapsUrlOrCoords: "no es un enlace" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.field).toBe("studioMapsUrl");
    expect(r.error).toContain("Google Maps");
  });

  it("al acortador se le explica qué hacer, porque el error es entendible", () => {
    const r = parseStudioLocation({ mapsUrlOrCoords: "https://maps.app.goo.gl/xyz" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("Abrilo en el navegador");
  });
});

describe("direccionEnUnaLinea", () => {
  const vacia = { street: null, city: null, province: null, postalCode: null, lat: null, lng: null };

  it("arma la línea como se escribe en un sobre", () => {
    expect(
      direccionEnUnaLinea({ ...vacia, street: "San José 1672 Local 5", city: "Funes", province: "Santa Fe", postalCode: "2132" }),
    ).toBe("San José 1672 Local 5, Funes, Santa Fe (2132)");
  });

  it("con la ciudad sola alcanza", () => {
    expect(direccionEnUnaLinea({ ...vacia, city: "Funes" })).toBe("Funes");
  });

  it("sin nada, null", () => {
    expect(direccionEnUnaLinea(vacia)).toBeNull();
    // Un código postal suelto no es una dirección.
    expect(direccionEnUnaLinea({ ...vacia, postalCode: "2132" })).toBeNull();
  });
});

describe("tieneUbicacionPublicable", () => {
  const vacia = { street: null, city: null, province: null, postalCode: null, lat: null, lng: null };

  it("con la ciudad ya se puede decir dónde trabaja", () => {
    expect(tieneUbicacionPublicable({ ...vacia, city: "Funes" })).toBe(true);
  });

  it("sólo coordenadas no alcanza: nadie lee un par de números", () => {
    expect(tieneUbicacionPublicable({ ...vacia, lat: -32.9, lng: -60.6 })).toBe(false);
  });
});

describe("enlaceAlMapa", () => {
  const base = { street: "San José 1672", city: "Funes", province: "Santa Fe", postalCode: null };

  it("con coordenadas apunta al punto exacto", () => {
    expect(enlaceAlMapa({ ...base, lat: -32.9174, lng: -60.6505 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=-32.9174%2C-60.6505",
    );
  });

  it("sin coordenadas busca por el texto de la dirección", () => {
    expect(enlaceAlMapa({ ...base, lat: null, lng: null })).toContain(
      "query=San%20Jos%C3%A9%201672%2C%20Funes%2C%20Santa%20Fe",
    );
  });

  it("sin dirección no hay enlace", () => {
    expect(
      enlaceAlMapa({ street: null, city: null, province: null, postalCode: null, lat: null, lng: null }),
    ).toBeNull();
  });
});
