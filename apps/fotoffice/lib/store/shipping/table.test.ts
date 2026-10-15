import { describe, expect, it } from "vitest";
import { pickRate, pickZone } from "./table";

const z = (o: Partial<Parameters<typeof pickZone>[0][number]> & { id: string }) => ({
  postalCodes: [], provinceCodes: [], isRestOfCountry: false, sortOrder: 0, ...o,
});
const dest = { postalCode: "2000", provinceCode: "S" };

describe("pickZone", () => {
  it("sin zonas devuelve null", () => expect(pickZone([], dest)).toBeNull());
  it("ninguna coincide devuelve null", () => {
    expect(pickZone([z({ id: "a", provinceCodes: ["B"] })], dest)).toBeNull();
  });
  it("coincide por código postal", () => {
    expect(pickZone([z({ id: "a", postalCodes: ["2000"] })], dest)).toBe("a");
  });
  it("normaliza los códigos postales de las zonas (CPA)", () => {
    expect(pickZone([z({ id: "a", postalCodes: ["S2000ABC"] })], dest)).toBe("a");
  });
  it("prioriza CP > provincia > resto, sin importar sortOrder", () => {
    const zones = [
      z({ id: "rest", isRestOfCountry: true, sortOrder: 0 }),
      z({ id: "prov", provinceCodes: ["S"], sortOrder: 1 }),
      z({ id: "cp", postalCodes: ["2000"], sortOrder: 9 }),
    ];
    expect(pickZone(zones, dest)).toBe("cp");
    expect(pickZone(zones.slice(0, 2), dest)).toBe("prov");
    expect(pickZone(zones.slice(0, 1), dest)).toBe("rest");
  });
  it("zona con CP y provincia a la vez cuenta como CP", () => {
    const zones = [
      z({ id: "prov", provinceCodes: ["S"], sortOrder: 0 }),
      z({ id: "both", postalCodes: ["2000"], provinceCodes: ["S"], sortOrder: 5 }),
    ];
    expect(pickZone(zones, dest)).toBe("both");
  });
  it("empate: menor sortOrder y luego id", () => {
    expect(pickZone([z({ id: "b", provinceCodes: ["S"], sortOrder: 2 }), z({ id: "a", provinceCodes: ["S"], sortOrder: 1 })], dest)).toBe("a");
    expect(pickZone([z({ id: "b", provinceCodes: ["S"] }), z({ id: "a", provinceCodes: ["S"] })], dest)).toBe("a");
  });
  it("destino con CP inválido igual puede coincidir por provincia", () => {
    expect(pickZone([z({ id: "p", provinceCodes: ["S"] })], { postalCode: "xx", provinceCode: "S" })).toBe("p");
  });
});

describe("pickRate", () => {
  const rates = [
    { maxGrams: 2000, priceMinor: 500 },
    { maxGrams: 500, priceMinor: 300 },
    { maxGrams: 5000, priceMinor: 900 },
  ];
  it("sin escalones devuelve null", () => expect(pickRate([], 100)).toBeNull());
  it("elige el primer escalón que alcanza, aunque vengan desordenados", () => {
    expect(pickRate(rates, 100)).toBe(300);
    expect(pickRate(rates, 501)).toBe(500);
  });
  it("peso exacto en el límite entra en ese escalón", () => {
    expect(pickRate(rates, 500)).toBe(300);
    expect(pickRate(rates, 2000)).toBe(500);
  });
  it("peso por encima del último escalón devuelve null", () => {
    expect(pickRate(rates, 5001)).toBeNull();
  });
  it("no modifica el arreglo recibido", () => {
    const copy = [...rates];
    pickRate(rates, 1);
    expect(rates).toEqual(copy);
  });
});
