import { describe, expect, it } from "vitest";
import { applyFilter, withDistance } from "./nearby";
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
});
