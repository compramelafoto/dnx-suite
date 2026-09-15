import { describe, expect, it } from "vitest";
import {
  assertApplicationTransition,
  assertAssignmentTransition,
  assertCallTransition,
  assertCoverageTransition,
  assertRequestTransition,
  assignmentTransitionRequiresReason,
  callTransitionRequiresReason,
  canTransitionApplication,
  canTransitionAssignment,
  canTransitionCall,
  canTransitionCoverage,
  canTransitionRequest,
  coverageTransitionRequiresReason,
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

/**
 * La máquina de estados de la cobertura: el trabajo concreto que sale de una solicitud
 * aprobada. `SIN_EQUIPO` no vuelve a `BUSCANDO_EQUIPO` porque la convocatoria es 1:1 con la
 * cobertura y ya está vencida; retomar la búsqueda es una cobertura nueva, no reabrir esta.
 */
describe("canTransitionCoverage", () => {
  it("el camino feliz completo", () => {
    expect(canTransitionCoverage("PLANIFICADA", "BUSCANDO_EQUIPO")).toBe(true);
    expect(canTransitionCoverage("BUSCANDO_EQUIPO", "EQUIPO_CONFIRMADO")).toBe(true);
    expect(canTransitionCoverage("EQUIPO_CONFIRMADO", "REALIZADA")).toBe(true);
    expect(canTransitionCoverage("REALIZADA", "ENTREGADA")).toBe(true);
    expect(canTransitionCoverage("ENTREGADA", "CERRADA")).toBe(true);
  });

  it("un rechazo tardío devuelve el equipo confirmado a buscando equipo", () => {
    expect(canTransitionCoverage("EQUIPO_CONFIRMADO", "BUSCANDO_EQUIPO")).toBe(true);
  });

  it("una convocatoria vencida sin completar los roles deja la cobertura sin equipo", () => {
    expect(canTransitionCoverage("BUSCANDO_EQUIPO", "SIN_EQUIPO")).toBe(true);
  });

  it("no se salta la búsqueda de equipo", () => {
    expect(canTransitionCoverage("PLANIFICADA", "EQUIPO_CONFIRMADO")).toBe(false);
  });

  it("sin equipo es terminal: no se reabre sola", () => {
    expect(canTransitionCoverage("SIN_EQUIPO", "BUSCANDO_EQUIPO")).toBe(false);
  });

  it("cerrada es el final", () => {
    expect(canTransitionCoverage("CERRADA", "REALIZADA")).toBe(false);
    expect(canTransitionCoverage("CERRADA", "CERRADA")).toBe(false);
  });

  it("cancelar se puede desde cualquier estado vivo", () => {
    expect(canTransitionCoverage("PLANIFICADA", "CANCELADA")).toBe(true);
    expect(canTransitionCoverage("BUSCANDO_EQUIPO", "CANCELADA")).toBe(true);
    expect(canTransitionCoverage("EQUIPO_CONFIRMADO", "CANCELADA")).toBe(true);
    expect(canTransitionCoverage("CERRADA", "CANCELADA")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionCoverage("BUSCANDO_EQUIPO", "BUSCANDO_EQUIPO")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionCoverage("PLANIFICADA", "SUPER_LISTA")).toBe(false);
    expect(canTransitionCoverage("CUALQUIERA", "PLANIFICADA")).toBe(false);
  });
});

describe("coverageTransitionRequiresReason", () => {
  it("cancelar exige motivo", () => {
    expect(coverageTransitionRequiresReason("CANCELADA")).toBe(true);
  });

  it("el resto no exige motivo", () => {
    expect(coverageTransitionRequiresReason("SIN_EQUIPO")).toBe(false);
    expect(coverageTransitionRequiresReason("REALIZADA")).toBe(false);
  });
});

describe("assertCoverageTransition", () => {
  it("no deja cancelar sin motivo", () => {
    const r = assertCoverageTransition({ from: "PLANIFICADA", to: "CANCELADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("con motivo, cancelar se acepta", () => {
    expect(
      assertCoverageTransition({
        from: "PLANIFICADA",
        to: "CANCELADA",
        reason: "La organización canceló la actividad.",
      }),
    ).toEqual({ ok: true });
  });

  it("rechaza una transición inválida y dice cuál era", () => {
    const r = assertCoverageTransition({ from: "PLANIFICADA", to: "REALIZADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Planificada");
  });
});

/**
 * La máquina de estados de la convocatoria: la publicación de una cobertura. `COMPLETA` vuelve
 * a `PUBLICADA` cuando alguien seleccionado rechaza — ver Tarea 8 del plan — porque el rol
 * vuelve a tener una vacante libre y la convocatoria tiene que volver a mostrarse como abierta.
 */
describe("canTransitionCall", () => {
  it("el camino feliz: borrador, publicada, completa, cerrada", () => {
    expect(canTransitionCall("BORRADOR", "PUBLICADA")).toBe(true);
    expect(canTransitionCall("PUBLICADA", "COMPLETA")).toBe(true);
    expect(canTransitionCall("COMPLETA", "CERRADA")).toBe(true);
  });

  it("una publicada sin completar los roles a tiempo vence", () => {
    expect(canTransitionCall("PUBLICADA", "VENCIDA")).toBe(true);
  });

  it("un rechazo devuelve la convocatoria completa a publicada", () => {
    expect(canTransitionCall("COMPLETA", "PUBLICADA")).toBe(true);
  });

  it("no se salta la publicación", () => {
    expect(canTransitionCall("BORRADOR", "COMPLETA")).toBe(false);
  });

  it("vencida es terminal", () => {
    expect(canTransitionCall("VENCIDA", "PUBLICADA")).toBe(false);
  });

  it("cerrada es el final", () => {
    expect(canTransitionCall("CERRADA", "PUBLICADA")).toBe(false);
    expect(canTransitionCall("CERRADA", "CERRADA")).toBe(false);
  });

  it("cancelar se puede desde cualquier estado vivo", () => {
    expect(canTransitionCall("BORRADOR", "CANCELADA")).toBe(true);
    expect(canTransitionCall("PUBLICADA", "CANCELADA")).toBe(true);
    expect(canTransitionCall("COMPLETA", "CANCELADA")).toBe(true);
    expect(canTransitionCall("VENCIDA", "CANCELADA")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionCall("PUBLICADA", "PUBLICADA")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionCall("BORRADOR", "SUPER_PUBLICADA")).toBe(false);
  });
});

describe("callTransitionRequiresReason", () => {
  it("cancelar exige motivo", () => {
    expect(callTransitionRequiresReason("CANCELADA")).toBe(true);
  });

  it("el resto no exige motivo", () => {
    expect(callTransitionRequiresReason("VENCIDA")).toBe(false);
    expect(callTransitionRequiresReason("COMPLETA")).toBe(false);
  });
});

describe("assertCallTransition", () => {
  it("no deja cancelar sin motivo", () => {
    const r = assertCallTransition({ from: "PUBLICADA", to: "CANCELADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("con motivo, cancelar se acepta", () => {
    expect(
      assertCallTransition({
        from: "PUBLICADA",
        to: "CANCELADA",
        reason: "La actividad se reprogramó para el año que viene.",
      }),
    ).toEqual({ ok: true });
  });
});

/**
 * La máquina de estados de la postulación. `EN_REVISION` y `PRESELECCIONADA` son pasos
 * opcionales: el coordinador puede seleccionar directo desde `RECIBIDA`, así que las cuatro
 * resoluciones (`SELECCIONADA`, `NO_SELECCIONADA`, `RETIRADA`, `VENCIDA`) se alcanzan desde
 * cualquier estado vivo.
 */
describe("canTransitionApplication", () => {
  it("el camino con revisión: recibida, en revisión, preseleccionada, seleccionada", () => {
    expect(canTransitionApplication("RECIBIDA", "EN_REVISION")).toBe(true);
    expect(canTransitionApplication("EN_REVISION", "PRESELECCIONADA")).toBe(true);
    expect(canTransitionApplication("PRESELECCIONADA", "SELECCIONADA")).toBe(true);
  });

  it("el coordinador puede seleccionar directo, sin pasar por revisión ni preselección", () => {
    expect(canTransitionApplication("RECIBIDA", "SELECCIONADA")).toBe(true);
  });

  it("rechazar también puede ser directo, desde cualquier paso vivo", () => {
    expect(canTransitionApplication("RECIBIDA", "NO_SELECCIONADA")).toBe(true);
    expect(canTransitionApplication("EN_REVISION", "NO_SELECCIONADA")).toBe(true);
  });

  it("la persona puede retirarse en cualquier momento antes de una decisión", () => {
    expect(canTransitionApplication("RECIBIDA", "RETIRADA")).toBe(true);
    expect(canTransitionApplication("PRESELECCIONADA", "RETIRADA")).toBe(true);
  });

  it("una postulación vencida no admite ninguna decisión", () => {
    expect(canTransitionApplication("VENCIDA", "SELECCIONADA")).toBe(false);
  });

  it("seleccionada es el final: no vuelve atrás", () => {
    expect(canTransitionApplication("SELECCIONADA", "NO_SELECCIONADA")).toBe(false);
    expect(canTransitionApplication("SELECCIONADA", "SELECCIONADA")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionApplication("EN_REVISION", "EN_REVISION")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionApplication("RECIBIDA", "SUPERSELECCIONADA")).toBe(false);
  });
});

describe("assertApplicationTransition", () => {
  it("rechazar no exige motivo: no es un reproche que se le deba a un voluntario", () => {
    expect(assertApplicationTransition({ from: "RECIBIDA", to: "NO_SELECCIONADA" })).toEqual({
      ok: true,
    });
  });

  it("retirarse tampoco exige motivo", () => {
    expect(assertApplicationTransition({ from: "RECIBIDA", to: "RETIRADA" })).toEqual({
      ok: true,
    });
  });

  it("rechaza una transición inválida y dice cuál era", () => {
    const r = assertApplicationTransition({ from: "SELECCIONADA", to: "RECIBIDA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Seleccionada");
  });
});

/**
 * La máquina de estados de la asignación. `CUMPLIDA` y `AUSENTE` no tienen pantalla en esta
 * etapa —pertenecen al registro de participación, que es 1c— pero se implementan ahora para no
 * tener que volver a tocar este archivo.
 */
describe("canTransitionAssignment", () => {
  it("el camino con aceptación explícita", () => {
    expect(canTransitionAssignment("PROPUESTA", "INVITADA")).toBe(true);
    expect(canTransitionAssignment("INVITADA", "ACEPTADA")).toBe(true);
    expect(canTransitionAssignment("ACEPTADA", "CONFIRMADA")).toBe(true);
    expect(canTransitionAssignment("CONFIRMADA", "CUMPLIDA")).toBe(true);
  });

  it("en esta etapa la persona confirma en un solo paso, sin pasar por aceptada", () => {
    expect(canTransitionAssignment("INVITADA", "CONFIRMADA")).toBe(true);
  });

  it("rechazar la invitación se puede desde invitada o desde aceptada", () => {
    expect(canTransitionAssignment("INVITADA", "RECHAZADA")).toBe(true);
    expect(canTransitionAssignment("ACEPTADA", "RECHAZADA")).toBe(true);
  });

  it("marcar ausente solo tiene sentido después de confirmar", () => {
    expect(canTransitionAssignment("CONFIRMADA", "AUSENTE")).toBe(true);
    expect(canTransitionAssignment("INVITADA", "AUSENTE")).toBe(false);
  });

  it("cancelar y reemplazar se pueden desde cualquier estado vivo", () => {
    expect(canTransitionAssignment("PROPUESTA", "CANCELADA")).toBe(true);
    expect(canTransitionAssignment("INVITADA", "REEMPLAZADA")).toBe(true);
    expect(canTransitionAssignment("CONFIRMADA", "CANCELADA")).toBe(true);
    expect(canTransitionAssignment("CUMPLIDA", "CANCELADA")).toBe(false);
  });

  it("cumplida es el final", () => {
    expect(canTransitionAssignment("CUMPLIDA", "CONFIRMADA")).toBe(false);
    expect(canTransitionAssignment("CUMPLIDA", "CUMPLIDA")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionAssignment("INVITADA", "INVITADA")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionAssignment("INVITADA", "SUPERACEPTADA")).toBe(false);
  });
});

describe("assignmentTransitionRequiresReason", () => {
  it("cancelar y marcar ausente exigen motivo", () => {
    expect(assignmentTransitionRequiresReason("CANCELADA")).toBe(true);
    expect(assignmentTransitionRequiresReason("AUSENTE")).toBe(true);
  });

  it("el resto no exige motivo", () => {
    expect(assignmentTransitionRequiresReason("CONFIRMADA")).toBe(false);
    expect(assignmentTransitionRequiresReason("RECHAZADA")).toBe(false);
    expect(assignmentTransitionRequiresReason("REEMPLAZADA")).toBe(false);
  });
});

describe("assertAssignmentTransition", () => {
  it("no deja marcar ausente sin motivo", () => {
    const r = assertAssignmentTransition({ from: "CONFIRMADA", to: "AUSENTE" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("con motivo, marcar ausente se acepta", () => {
    expect(
      assertAssignmentTransition({
        from: "CONFIRMADA",
        to: "AUSENTE",
        reason: "No se presentó ni avisó.",
      }),
    ).toEqual({ ok: true });
  });

  it("confirmar no exige motivo", () => {
    expect(assertAssignmentTransition({ from: "INVITADA", to: "CONFIRMADA" })).toEqual({
      ok: true,
    });
  });
});
