import { describe, expect, it } from "vitest";
import { diaArgentino, estaVigente, rangoArgentino } from "./slots";

describe("rangoArgentino", () => {
  it("un solo día va de su medianoche argentina a la del día siguiente", () => {
    const r = rangoArgentino("2026-10-06", "2026-10-06");
    expect(r).toEqual({
      startsAt: new Date("2026-10-06T03:00:00.000Z"),
      endsAt: new Date("2026-10-07T03:00:00.000Z"),
    });
  });

  it("el día de fin entra entero", () => {
    const r = rangoArgentino("2026-10-01", "2026-10-31");
    expect(r).toEqual({
      startsAt: new Date("2026-10-01T03:00:00.000Z"),
      endsAt: new Date("2026-11-01T03:00:00.000Z"),
    });
  });

  it("rechaza un fin anterior al inicio", () => {
    expect(rangoArgentino("2026-10-10", "2026-10-09")).toEqual({
      error: "La fecha de fin no puede ser anterior a la de inicio.",
    });
  });

  it("rechaza fechas mal escritas o inexistentes", () => {
    expect(rangoArgentino("10/10/2026", "2026-10-11")).toHaveProperty("error");
    expect(rangoArgentino("2026-02-30", "2026-03-01")).toHaveProperty("error");
    expect(rangoArgentino("", "")).toHaveProperty("error");
  });
});

describe("estaVigente", () => {
  const b = { startsAt: new Date("2026-10-06T03:00:00Z"), endsAt: new Date("2026-10-07T03:00:00Z") };

  it("vale desde el primer instante y hasta antes del fin", () => {
    expect(estaVigente(b, new Date("2026-10-06T03:00:00Z"))).toBe(true);
    expect(estaVigente(b, new Date("2026-10-07T02:59:59Z"))).toBe(true);
    expect(estaVigente(b, new Date("2026-10-07T03:00:00Z"))).toBe(false);
    expect(estaVigente(b, new Date("2026-10-06T02:59:59Z"))).toBe(false);
  });
});

describe("diaArgentino", () => {
  it("devuelve el día de calendario en Argentina, no en UTC", () => {
    // 01:30 UTC del 7 son las 22:30 del 6 en Argentina.
    expect(diaArgentino(new Date("2026-10-07T01:30:00Z"))).toBe("2026-10-06");
  });

  it("el fin guardado (medianoche del día siguiente) se lee como el último día incluido", () => {
    expect(diaArgentino(new Date("2026-11-01T03:00:00Z"), { esFin: true })).toBe("2026-10-31");
  });
});
