import { describe, expect, it } from "vitest";
import { MAX_PLACE_LABEL, applyFilter, cleanPlaceLabel, distanceLabel, nearHref, parseNearParam, withDistance } from "./nearby";
import { dayEndAr, dayStartAr } from "./dates";

const rosario = { latitude: -32.9468, longitude: -60.6393 };

describe("withDistance", () => {
  it("ordena por distancia y deja las virtuales al final", () => {
    const r = withDistance(rosario, [
      { id: "cba", latitude: -31.4201, longitude: -64.1888 },
      { id: "virtual", latitude: null, longitude: null },
      { id: "parana", latitude: -31.7413, longitude: -60.5115 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["parana", "cba", "virtual"]);
    expect(r[0]!.distanceKm).toBeGreaterThan(100);
    expect(r[0]!.distanceKm).toBeLessThan(160);
    expect(r[2]!.distanceKm).toBeNull();
  });
});

describe("applyFilter", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const items = [
    { id: "abierta", province: "Santa Fe", type: "MUESTRA", startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") },
    { id: "proxima", province: "Córdoba", type: "TALLER", startsAt: dayStartAr("2026-12-01"), endsAt: dayEndAr("2026-12-01") },
    { id: "cerrada", province: "Santa Fe", type: "MUESTRA", startsAt: dayStartAr("2026-10-01"), endsAt: dayEndAr("2026-10-20") },
  ];
  it("por defecto oculta las cerradas", () => expect(applyFilter(items, {}, now).map((x) => x.id)).toEqual(["abierta", "proxima"]));
  it("incluye cerradas si se pide (archivo)", () => expect(applyFilter(items, { includeClosed: true }, now)).toHaveLength(3));
  it("filtra por provincia sin importar mayúsculas ni tildes", () => expect(applyFilter(items, { province: "cordoba" }, now).map((x) => x.id)).toEqual(["proxima"]));
  it("filtra por tipo", () => expect(applyFilter(items, { type: "TALLER" }, now).map((x) => x.id)).toEqual(["proxima"]));
  it("abiertas ahora", () => expect(applyFilter(items, { openNow: true }, now).map((x) => x.id)).toEqual(["abierta"]));
  it("filtra por país; sin país cuenta como Argentina", () => {
    const conPais = [
      ...items,
      { id: "montevideo", country: "Uruguay", province: "Montevideo", type: "MUESTRA", startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") },
      { id: "sao-paulo", country: "Brasil", province: "São Paulo", type: "MUESTRA", startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") },
    ];
    expect(applyFilter(conPais, { country: "uruguay" }, now).map((x) => x.id)).toEqual(["montevideo"]);
    expect(applyFilter(conPais, { country: "Argentina" }, now).map((x) => x.id)).toEqual(["abierta", "proxima"]);
    expect(applyFilter(conPais, { country: "Brasil", province: "sao paulo" }, now).map((x) => x.id)).toEqual(["sao-paulo"]);
  });
});

describe("parseNearParam", () => {
  it("lee dos números dentro de Argentina", () => {
    expect(parseNearParam("-32.95,-60.65")).toEqual({ latitude: -32.95, longitude: -60.65 });
    expect(parseNearParam(" -54.8 , -68.3 ")).toEqual({ latitude: -54.8, longitude: -68.3 });
  });
  it("toma el primero si viene repetido", () => expect(parseNearParam(["-31.4,-64.2", "x"])).toEqual({ latitude: -31.4, longitude: -64.2 }));
  it("rechaza lo que no son dos números", () => {
    for (const v of ["", "-32.95", "-32.95,-60.65,1", "abc,def", "1e1,-60", "-32,95;-60", "NaN,NaN", "Infinity,-60", "-32.95,", "0x1,-60", undefined, null, 42])
      expect(parseNearParam(v), String(v)).toBeNull();
  });
  it("rechaza puntos fuera de Argentina", () => {
    expect(parseNearParam("40.4,-3.7")).toBeNull(); // Madrid
    expect(parseNearParam("-23.55,-46.63")).toBeNull(); // San Pablo
    expect(parseNearParam("-91,-60")).toBeNull();
  });
  it("rechaza textos larguísimos", () => expect(parseNearParam(`-32.${"1".repeat(50)},-60.6`)).toBeNull());
});

describe("cleanPlaceLabel", () => {
  it("colapsa espacios y saca caracteres de control", () => expect(cleanPlaceLabel("  Rosario\n\t centro ")).toBe("Rosario centro"));
  it("acota el largo", () => expect(cleanPlaceLabel("a".repeat(200))).toHaveLength(MAX_PLACE_LABEL));
  it("vacío o no texto → null", () => {
    expect(cleanPlaceLabel("   ")).toBeNull();
    expect(cleanPlaceLabel(undefined)).toBeNull();
    expect(cleanPlaceLabel(["Paraná"])).toBe("Paraná");
  });
  it("deja el texto como texto: no lo interpreta", () => expect(cleanPlaceLabel("<b>Rosario</b>")).toBe("<b>Rosario</b>"));
});

describe("nearHref y distanceLabel", () => {
  it("arma el enlace con cuatro decimales y el lugar", () => {
    expect(nearHref({ latitude: -32.946812, longitude: -60.639321 }, "Rosario")).toBe("/?cerca=-32.9468%2C-60.6393&lugar=Rosario#muestras");
  });
  it("sin lugar no lo pone", () => expect(nearHref({ latitude: -32.9, longitude: -60.6 }, " ")).toBe("/?cerca=-32.9000%2C-60.6000#muestras"));
  it("lo que arma, se vuelve a leer igual", () => {
    const href = nearHref({ latitude: -34.6037, longitude: -58.3816 }, "Buenos Aires");
    const q = new URLSearchParams(href.slice(2, href.indexOf("#")));
    expect(parseNearParam(q.get("cerca"))).toEqual({ latitude: -34.6037, longitude: -58.3816 });
  });
  it("redondea la distancia", () => {
    expect(distanceLabel(null)).toBeNull();
    expect(distanceLabel(0.4)).toBe("a menos de 1 km");
    expect(distanceLabel(12.6)).toBe("a 13 km");
    expect(distanceLabel(1234.2)).toBe("a 1.234 km");
  });
  it("ordena por cercanía al punto buscado", () => {
    const origen = parseNearParam("-32.95,-60.65")!;
    const r = withDistance(origen, [
      { id: "cba", latitude: -31.4201, longitude: -64.1888 },
      { id: "rosario", latitude: -32.9468, longitude: -60.6393 },
    ]);
    expect(r.map((x) => [x.id, distanceLabel(x.distanceKm)])).toEqual([["rosario", "a 1 km"], ["cba", "a 374 km"]]);
  });
});
