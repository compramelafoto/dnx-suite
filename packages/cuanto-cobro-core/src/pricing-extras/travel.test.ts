import { describe, expect, it } from "vitest";
import { computeTravel, straightLineKm } from "./travel";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS as BASE } from "./types";

describe("viáticos", () => {
  it("por km: ida y vuelta menos los km libres, por el valor del km", () => {
    const r = computeTravel({ ...BASE, travelMode: "per_km", travelPerKm: "300", travelFreeKm: "20" }, { distanceKm: "40" });
    // 40 × 2 = 80 km − 20 libres = 60 × 300
    expect(r).toEqual({ km: 40, mode: "per_km", zoneName: null, cost: 18_000, warnings: [] });
  });

  it("por km, cerca: no paga nada si no supera los km libres", () => {
    const r = computeTravel({ ...BASE, travelMode: "per_km", travelPerKm: "300", travelFreeKm: "20" }, { distanceKm: "5" });
    expect(r?.cost).toBe(0);
  });

  it("por zonas: la primera que cubre la distancia; si se elige una, esa", () => {
    const extras = {
      ...BASE,
      travelMode: "zones" as const,
      travelZones: [
        { id: "z1", name: "Rosario", upToKm: "15", amount: "0" },
        { id: "z2", name: "Gran Rosario", upToKm: "40", amount: "25000" },
        { id: "z3", name: "Región", upToKm: "120", amount: "60000" },
      ],
    };
    expect(computeTravel(extras, { distanceKm: "30" })).toMatchObject({ zoneName: "Gran Rosario", cost: 25_000 });
    expect(computeTravel(extras, { travelZoneId: "z3" })).toMatchObject({ zoneName: "Región", cost: 60_000 });
    expect(computeTravel(extras, { distanceKm: "300" })).toMatchObject({ zoneName: "Región", cost: 60_000 });
    expect(computeTravel(extras, { distanceKm: "300" })?.warnings[0]).toMatch(/más lejos que tu última zona/);
  });

  it("sin distancia pero con coordenadas del estudio y del evento: línea recta × 1,3", () => {
    const km = straightLineKm(-32.9468, -60.6393, -31.6333, -60.7);
    expect(km).toBeGreaterThan(140);
    expect(km).toBeLessThan(150);
    const r = computeTravel(
      { ...BASE, travelMode: "per_km", travelPerKm: "100", studioLatitude: "-32.9468", studioLongitude: "-60.6393" },
      { jobLatitude: "-31.6333", jobLongitude: "-60.7" },
    );
    expect(r!.km).toBeCloseTo(km * 1.3, 0);
  });

  it("sin modo o sin distancia: null", () => {
    expect(computeTravel(BASE, { distanceKm: "40" })).toBeNull();
    expect(computeTravel({ ...BASE, travelMode: "per_km", travelPerKm: "300" }, {})).toBeNull();
  });
});
