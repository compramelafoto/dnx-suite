import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { assertRequestTransition } from "./transitions";
import { recomendarRefuerzo } from "./reinforcement";
import { terminologyFor } from "./terminology";
import { planSubmission } from "./submit-plan";
import { resolveTrackingView } from "./tracking-view";

/**
 * Los criterios de aceptación del diseño, como test.
 *
 * No repiten lo que ya prueban los tests de cada pieza: recorren el circuito completo con los
 * mismos datos del caso de demostración, que es la forma de descubrir que dos piezas correctas
 * por separado no encajan.
 *
 * Los datos salen del §32 del documento original: Asociación Manos Abiertas, jornada solidaria
 * del 26.09.2026 de 14:00 a 18:30 en Rosario, 4 h 30 de duración.
 */
describe("el caso de la jornada solidaria", () => {
  const settings = { ...DEFAULT_COVERAGE_SETTINGS, publicFormEnabled: true };
  const inicio = new Date("2026-09-26T17:00:00Z"); // 14:00 en Argentina
  const fin = new Date("2026-09-26T21:30:00Z"); // 18:30
  const duracion = (fin.getTime() - inicio.getTime()) / 60000;

  it("supera las 3 horas y el sistema recomienda dos voluntarios", () => {
    const r = recomendarRefuerzo({ durationMinutes: duracion, assigned: 0, settings });
    expect(r?.recommended).toBe(2);
  });

  it("la recomendación no bloquea: es un aviso, no un freno", () => {
    // El coordinador puede seguir igual. Que la recomendación exista no cambia ninguna
    // transición válida.
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "APROBADA" })).toEqual({
      ok: true,
    });
  });

  it("el circuito completo: recibida, evaluada, con un dato pedido, y aprobada", () => {
    expect(assertRequestTransition({ from: "RECIBIDA", to: "EN_EVALUACION" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "REQUIERE_INFO" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "REQUIERE_INFO", to: "EN_EVALUACION" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "APROBADA" }).ok).toBe(true);
  });

  it("mientras se le pide un dato, la organización puede responder desde su enlace", () => {
    const v = resolveTrackingView(
      {
        status: "REQUIERE_INFO",
        tokenExpiresAt: new Date("2027-01-01T00:00:00Z"),
        tokenRevokedAt: null,
      },
      new Date("2026-09-14T12:00:00Z"),
    );
    expect(v).toEqual({ kind: "OK", puedeResponder: true });
  });

  it("el módulo no habla de FOTOPOSITIVA: con otra terminología dice otra cosa", () => {
    // Es el criterio 20 del diseño. Si alguna vez una palabra queda escrita en el código, este
    // test la encuentra.
    const ong = terminologyFor({ ...settings, termCollaborator: "Voluntario/a" });
    const estudio = terminologyFor({ ...settings, termCollaborator: "Fotógrafo" });
    expect(ong.collaborator).toBe("Voluntario/a");
    expect(estudio.collaborator).toBe("Fotógrafo");
  });

  it("con el formulario cerrado no entra nada, aunque el POST llegue", () => {
    const r = planSubmission({
      settings: { ...settings, publicFormEnabled: false },
      recientes: 0,
      duplicada: null,
      parsed: { contactEmail: "contacto@manos.org", startsAt: inicio },
    });
    expect(r.kind).toBe("RECHAZAR");
  });
});
