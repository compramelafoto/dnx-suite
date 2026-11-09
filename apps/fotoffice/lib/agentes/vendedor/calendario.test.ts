import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { AJUSTES_VENDEDOR_POR_OMISION } = await import("./ajustes");
const { cupoDelDia, cupoHastaAhora, enVentanaDeEnvio, esDiaHabil, venceRecordatorio } = await import("./calendario");

const d = (s: string) => new Date(s);

describe("esDiaHabil", () => {
  it("feriado, hábil y sábado", () => {
    expect(esDiaHabil("2026-12-08")).toBe(false);
    expect(esDiaHabil("2026-12-09")).toBe(true);
    expect(esDiaHabil("2026-12-12")).toBe(false);
  });
});

describe("enVentanaDeEnvio", () => {
  it("de 9:00 a 18:00 argentinas en día hábil", () => {
    expect(enVentanaDeEnvio(d("2026-11-10T11:59:00Z"))).toBe(false);
    expect(enVentanaDeEnvio(d("2026-11-10T12:00:00Z"))).toBe(true);
    expect(enVentanaDeEnvio(d("2026-11-10T20:59:00Z"))).toBe(true);
    expect(enVentanaDeEnvio(d("2026-11-10T21:00:00Z"))).toBe(false);
    expect(enVentanaDeEnvio(d("2026-11-14T15:00:00Z"))).toBe(false);
  });
});

describe("cupoDelDia", () => {
  const a = { ...AJUSTES_VENDEDOR_POR_OMISION, arrancoEn: "2026-11-10" };
  it("10 la primera semana, 20 después, 0 sin arranque", () => {
    expect(cupoDelDia(a, d("2026-11-16T15:00:00Z"))).toBe(10);
    expect(cupoDelDia(a, d("2026-11-17T15:00:00Z"))).toBe(20);
    expect(cupoDelDia({ ...a, arrancoEn: null }, d("2026-11-16T15:00:00Z"))).toBe(0);
  });
});

describe("cupoHastaAhora", () => {
  it("reparte el cupo a lo largo del día", () => {
    expect(cupoHastaAhora(20, d("2026-11-10T16:30:00Z"))).toBe(10);
    expect(cupoHastaAhora(20, d("2026-11-10T11:00:00Z"))).toBe(0);
    expect(cupoHastaAhora(20, d("2026-11-10T20:59:00Z"))).toBe(20);
  });
});

describe("venceRecordatorio", () => {
  it("a los 5 días hábiles, salteando feriados", () => {
    expect(venceRecordatorio(d("2026-12-07T15:00:00Z"), d("2026-12-14T15:00:00Z"))).toBe(false);
    expect(venceRecordatorio(d("2026-12-07T15:00:00Z"), d("2026-12-15T15:00:00Z"))).toBe(true);
  });
});
