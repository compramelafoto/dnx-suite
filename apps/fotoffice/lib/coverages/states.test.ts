import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  REQUEST_STATUSES,
  applicationStatusLabel,
  applicationStatusPortalLabel,
  requestStatusDoneMessage,
  requestStatusStep,
} from "./states";

/**
 * Las dos lecturas del mismo estado.
 *
 * Quien coordina lee una lista de veinte postulaciones y necesita una etiqueta corta. Quien se
 * ofreció un sábado lee UNA, la suya. La misma palabra no sirve para los dos.
 */
describe("applicationStatusPortalLabel", () => {
  it("a quien se anotó no se le dice «no seleccionada»", () => {
    // El panel puede decirlo: es una etiqueta de gestión. En el portal es un veredicto sobre
    // una persona que ofreció su tiempo gratis, y no es lo que pasó — el equipo se completó.
    expect(applicationStatusPortalLabel("NO_SELECCIONADA")).toBe(
      "Esta vez no hizo falta. Gracias por anotarte.",
    );
    expect(applicationStatusPortalLabel("NO_SELECCIONADA")).not.toContain("No seleccionada");
  });

  it("agradece, en vez de explicar un descarte", () => {
    expect(applicationStatusPortalLabel("NO_SELECCIONADA").toLowerCase()).toContain("gracias");
  });

  it("donde las dos lecturas coinciden, no se inventa una segunda palabra", () => {
    // El mapa es parcial a propósito: una copia entera habría que mantenerla al lado de la otra
    // y se desincroniza el día que alguien toque una sola de las dos.
    for (const estado of ["RECIBIDA", "EN_REVISION", "PRESELECCIONADA", "SELECCIONADA"]) {
      expect(applicationStatusPortalLabel(estado)).toBe(applicationStatusLabel(estado));
    }
  });

  it("todos los estados tienen algo que mostrar", () => {
    for (const estado of APPLICATION_STATUSES) {
      expect(applicationStatusPortalLabel(estado).trim().length).toBeGreaterThan(0);
    }
  });

  it("un estado inventado se muestra tal cual, sin romper la pantalla", () => {
    expect(applicationStatusPortalLabel("EN_VUELO")).toBe("EN_VUELO");
  });
});

/**
 * Dónde está el pedido y qué sigue.
 *
 * El panel de evaluación muestra acciones distintas según el estado y no decía en cuál estaba.
 * Que ningún estado se quede sin explicación no se puede verificar mirando la pantalla: hay ocho,
 * y los cuatro últimos casi nunca se ven.
 */
describe("requestStatusStep", () => {
  it("los ocho estados dicen dónde está el pedido y qué sigue", () => {
    for (const estado of REQUEST_STATUSES) {
      const paso = requestStatusStep(estado);
      expect(paso, estado).not.toBeNull();
      expect(paso!.donde.trim().length, estado).toBeGreaterThan(0);
      expect(paso!.queSigue.trim().length, estado).toBeGreaterThan(0);
    }
  });

  it("un estado inventado no rompe la pantalla: no hay paso que mostrar", () => {
    expect(requestStatusStep("EN_VUELO")).toBeNull();
  });
});

describe("requestStatusDoneMessage", () => {
  it("no promete un aviso que no salió", () => {
    // Un pedido sin correo cargado no le avisa a nadie. Decir que sí deja a la coordinación
    // esperando una respuesta que la organización nunca supo que tenía que dar.
    expect(requestStatusDoneMessage("APROBADA", { avisada: false })).not.toContain("avisamos");
    expect(requestStatusDoneMessage("RECHAZADA", { avisada: false })).not.toContain("avisamos");
    expect(requestStatusDoneMessage("APROBADA")).not.toContain("avisamos");
  });

  it("cuando el correo salió, lo dice", () => {
    expect(requestStatusDoneMessage("APROBADA", { avisada: true })).toContain("avisamos");
    expect(requestStatusDoneMessage("RECHAZADA", { avisada: true })).toContain("avisamos");
  });

  it("empezar a evaluar no le manda nada a nadie, y lo aclara", () => {
    // Es la duda de quien aprieta ese botón por primera vez: ¿ya se enteraron?
    expect(requestStatusDoneMessage("EN_EVALUACION", { avisada: true })).toContain("no recibe");
  });

  it("cada destino dice algo distinto: un «Listo.» para todos no informa nada", () => {
    const mensajes = ["EN_EVALUACION", "APROBADA", "RECHAZADA", "CERRADA"].map((d) =>
      requestStatusDoneMessage(d, { avisada: true }),
    );
    expect(new Set(mensajes).size).toBe(mensajes.length);
  });

  it("un destino inesperado no deja la pantalla muda", () => {
    expect(requestStatusDoneMessage("EN_VUELO").trim().length).toBeGreaterThan(0);
  });
});
