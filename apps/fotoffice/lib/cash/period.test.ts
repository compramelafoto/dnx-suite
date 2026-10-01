import { describe, expect, it } from "vitest";
import { esPeriodShortcut, resolvePeriodShortcut } from "./period";

describe("resolvePeriodShortcut", () => {
  it("este mes va del día 1 al último día del mes en curso", () => {
    expect(resolvePeriodShortcut("este-mes", "2026-09-13")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("este mes en febrero corta en el 28, no en el 30", () => {
    expect(resolvePeriodShortcut("este-mes", "2026-02-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("mes pasado no se confunde de año en enero", () => {
    expect(resolvePeriodShortcut("mes-pasado", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("mes pasado un mes cualquiera", () => {
    expect(resolvePeriodShortcut("mes-pasado", "2026-09-13")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("últimos 30 días incluye hoy y no se pasa de mes", () => {
    expect(resolvePeriodShortcut("ultimos-30", "2026-09-13")).toEqual({
      from: "2026-08-15",
      to: "2026-09-13",
    });
  });

  it("últimos 30 días cruza el cambio de año sin problema", () => {
    expect(resolvePeriodShortcut("ultimos-30", "2026-01-05")).toEqual({
      from: "2025-12-07",
      to: "2026-01-05",
    });
  });
});

describe("esPeriodShortcut", () => {
  it("acepta los tres atajos declarados", () => {
    expect(esPeriodShortcut("este-mes")).toBe(true);
    expect(esPeriodShortcut("mes-pasado")).toBe(true);
    expect(esPeriodShortcut("ultimos-30")).toBe(true);
  });

  it("rechaza cualquier otra cosa, incluido undefined", () => {
    expect(esPeriodShortcut(undefined)).toBe(false);
    expect(esPeriodShortcut("")).toBe(false);
    expect(esPeriodShortcut("este-anio")).toBe(false);
  });
});
