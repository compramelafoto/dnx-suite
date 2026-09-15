import { describe, expect, it } from "vitest";
import {
  assertRequestTransition,
  canTransitionRequest,
  transitionRequiresReason,
} from "./transitions";

/**
 * La máquina de estados de la solicitud.
 *
 * Es una función pura y no una columna con un `update` suelto porque el circuito tiene idas y
 * vueltas —pedir información y volver a evaluación— y sin una tabla de transiciones válidas
 * cualquier pantalla podría mandar una solicitud rechazada de vuelta a "aprobada" con un
 * formulario armado a mano.
 */
describe("canTransitionRequest", () => {
  it("el camino feliz: recibida, en evaluación, aprobada, cerrada", () => {
    expect(canTransitionRequest("RECIBIDA", "EN_EVALUACION")).toBe(true);
    expect(canTransitionRequest("EN_EVALUACION", "APROBADA")).toBe(true);
    expect(canTransitionRequest("APROBADA", "CERRADA")).toBe(true);
  });

  it("pedir información y volver", () => {
    expect(canTransitionRequest("EN_EVALUACION", "REQUIERE_INFO")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "EN_EVALUACION")).toBe(true);
  });

  it("se puede rechazar mientras se evalúa o falta información", () => {
    expect(canTransitionRequest("EN_EVALUACION", "RECHAZADA")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "RECHAZADA")).toBe(true);
  });

  it("una solicitud rechazada no vuelve: se pide de nuevo", () => {
    // Reabrir un rechazo dejaría el historial contando una historia falsa. Si la organización
    // insiste con datos nuevos, es una solicitud nueva.
    expect(canTransitionRequest("RECHAZADA", "EN_EVALUACION")).toBe(false);
    expect(canTransitionRequest("RECHAZADA", "APROBADA")).toBe(false);
  });

  it("no se salta la evaluación", () => {
    expect(canTransitionRequest("RECIBIDA", "APROBADA")).toBe(false);
  });

  it("cerrada es el final", () => {
    expect(canTransitionRequest("CERRADA", "APROBADA")).toBe(false);
    expect(canTransitionRequest("CERRADA", "CERRADA")).toBe(false);
  });

  it("cancelar se puede desde cualquier estado vivo", () => {
    expect(canTransitionRequest("RECIBIDA", "CANCELADA_SOLICITANTE")).toBe(true);
    expect(canTransitionRequest("APROBADA", "CANCELADA_ORGANIZACION")).toBe(true);
    expect(canTransitionRequest("CANCELADA_SOLICITANTE", "EN_EVALUACION")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionRequest("EN_EVALUACION", "EN_EVALUACION")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionRequest("EN_EVALUACION", "APROBADISIMA")).toBe(false);
    expect(canTransitionRequest("CUALQUIERA", "APROBADA")).toBe(false);
  });
});

describe("transitionRequiresReason", () => {
  it("rechazar y cancelar exigen motivo", () => {
    expect(transitionRequiresReason("RECHAZADA")).toBe(true);
    expect(transitionRequiresReason("CANCELADA_ORGANIZACION")).toBe(true);
    expect(transitionRequiresReason("CANCELADA_SOLICITANTE")).toBe(true);
  });

  it("aprobar no exige motivo", () => {
    expect(transitionRequiresReason("APROBADA")).toBe(false);
    expect(transitionRequiresReason("EN_EVALUACION")).toBe(false);
  });
});

describe("assertRequestTransition", () => {
  it("acepta una transición válida sin motivo cuando no hace falta", () => {
    expect(assertRequestTransition({ from: "RECIBIDA", to: "EN_EVALUACION" })).toEqual({
      ok: true,
    });
  });

  it("rechaza una transición inválida y dice cuál era", () => {
    const r = assertRequestTransition({ from: "RECIBIDA", to: "APROBADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Recibida");
  });

  it("no deja rechazar sin motivo", () => {
    const r = assertRequestTransition({ from: "EN_EVALUACION", to: "RECHAZADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("un motivo de espacios en blanco no cuenta como motivo", () => {
    const r = assertRequestTransition({
      from: "EN_EVALUACION",
      to: "RECHAZADA",
      reason: "   ",
    });
    expect(r.ok).toBe(false);
  });

  it("con motivo, rechazar se acepta", () => {
    expect(
      assertRequestTransition({
        from: "EN_EVALUACION",
        to: "RECHAZADA",
        reason: "La actividad no tiene finalidad solidaria.",
      }),
    ).toEqual({ ok: true });
  });
});
