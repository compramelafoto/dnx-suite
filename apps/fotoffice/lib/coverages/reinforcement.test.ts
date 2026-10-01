import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { recomendarRefuerzo } from "./reinforcement";

const settings = DEFAULT_COVERAGE_SETTINGS; // umbral 180 min, recomienda 2

/**
 * La regla de las 3 horas.
 *
 * Recomienda, nunca bloquea. Es deliberado: el coordinador conoce la actividad y puede tener
 * razones para ir con una sola persona. Lo que sí hace el sistema es dejar constancia de que
 * avisó.
 */
describe("recomendarRefuerzo", () => {
  it("una cobertura corta no necesita nada", () => {
    expect(recomendarRefuerzo({ durationMinutes: 120, assigned: 1, settings })).toBe(null);
  });

  it("justo en el umbral todavía no recomienda", () => {
    // 180 minutos son 3 horas exactas. La regla dice "más de 3 horas", no "3 o más".
    expect(recomendarRefuerzo({ durationMinutes: 180, assigned: 1, settings })).toBe(null);
  });

  it("un minuto más que el umbral ya recomienda", () => {
    const r = recomendarRefuerzo({ durationMinutes: 181, assigned: 1, settings });
    expect(r?.recommended).toBe(2);
  });

  it("el caso de la jornada solidaria: 4 h 30 con una persona", () => {
    const r = recomendarRefuerzo({ durationMinutes: 270, assigned: 1, settings });
    expect(r).not.toBe(null);
    expect(r?.recommended).toBe(2);
    expect(r?.reason).toContain("4 h 30");
    expect(r?.reason).toContain("3 h");
  });

  it("con el equipo ya completo no molesta", () => {
    expect(recomendarRefuerzo({ durationMinutes: 270, assigned: 2, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: 270, assigned: 5, settings })).toBe(null);
  });

  it("el umbral y la cantidad se configuran: una agencia puede pedir otra cosa", () => {
    const propios = {
      ...settings,
      reinforcementThresholdMinutes: 60,
      recommendedCollaborators: 3,
    };
    const r = recomendarRefuerzo({ durationMinutes: 90, assigned: 1, settings: propios });
    expect(r?.recommended).toBe(3);
    expect(r?.reason).toContain("1 h");
  });

  it("una duración inválida no rompe la pantalla", () => {
    // Las fechas las carga una persona y pueden llegar dadas vuelta.
    expect(recomendarRefuerzo({ durationMinutes: 0, assigned: 0, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: -30, assigned: 0, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: Number.NaN, assigned: 0, settings })).toBe(null);
  });
});
