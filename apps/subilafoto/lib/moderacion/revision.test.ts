import { describe, expect, test } from "vitest";
import {
  MOTIVOS_NO_REVERSIBLES,
  accionesPosibles,
  estadoResultante,
  validarRevision,
} from "./revision";

describe("qué puede hacer el fotógrafo con cada foto", () => {
  test("una retenida se puede aprobar o bloquear", () => {
    expect([...accionesPosibles("REVIEW_REQUIRED")].sort()).toEqual(["APROBAR", "BLOQUEAR"]);
  });

  test("una bloqueada sólo se puede aprobar, si fue un error", () => {
    expect([...accionesPosibles("BLOCKED")]).toEqual(["APROBAR"]);
  });

  test("una aprobada se puede ocultar sin dar explicaciones: es su evento", () => {
    expect([...accionesPosibles("APPROVED")]).toEqual(["OCULTAR"]);
    expect(validarRevision({ estado: "APPROVED", accion: "OCULTAR", motivo: "" }).ok).toBe(true);
  });

  test("una oculta se puede volver a mostrar", () => {
    expect([...accionesPosibles("HIDDEN")]).toEqual(["RESTAURAR"]);
  });

  test("sobre una que todavía se está analizando no se hace nada", () => {
    // Está en la cola. Tocarla acá sería pelearse con el proceso automático.
    expect(accionesPosibles("PROCESSING")).toEqual([]);
  });
});

describe("contradecir a la máquina exige explicar por qué", () => {
  test("aprobar algo que la IA retuvo pide motivo", () => {
    const sin = validarRevision({ estado: "REVIEW_REQUIRED", accion: "APROBAR", motivo: "" });
    expect(sin.ok).toBe(false);
    expect(sin.motivo).toMatch(/por qué|motivo/i);
  });

  test("un motivo de dos letras no es un motivo", () => {
    expect(validarRevision({ estado: "BLOCKED", accion: "APROBAR", motivo: "ok" }).ok).toBe(false);
  });

  test("con un motivo de verdad, pasa", () => {
    expect(
      validarRevision({
        estado: "REVIEW_REQUIRED",
        accion: "APROBAR",
        motivo: "Es una copa de champán en un brindis, no hay nada raro.",
      }).ok,
    ).toBe(true);
  });

  test("bloquear no pide motivo: el que bloquea está siendo prudente", () => {
    expect(validarRevision({ estado: "REVIEW_REQUIRED", accion: "BLOQUEAR", motivo: "" }).ok).toBe(
      true,
    );
  });
});

describe("lo que ni el dueño del evento puede desbloquear", () => {
  test.each(MOTIVOS_NO_REVERSIBLES)("«%s» no se puede aprobar a mano", (motivoIa) => {
    const r = validarRevision({
      estado: "BLOCKED",
      accion: "APROBAR",
      motivo: "Me parece que está bien igual, la quiero proyectar.",
      motivoDeLaIa: motivoIa,
    });
    expect(r.ok).toBe(false);
  });

  test("en cambio, un falso positivo de violencia sí se puede rescatar", () => {
    // Una espada de disfraz, un cotillón. Pasa, y tiene que poder arreglarse.
    const r = validarRevision({
      estado: "BLOCKED",
      accion: "APROBAR",
      motivo: "Es una espada de juguete del cotillón de la fiesta.",
      motivoDeLaIa: "Violence",
    });
    expect(r.ok).toBe(true);
  });
});

describe("en qué estado queda la foto", () => {
  test("aprobar la publica, bloquear y ocultar no", () => {
    expect(estadoResultante("APROBAR")).toEqual({ estado: "APPROVED", publicar: true });
    expect(estadoResultante("BLOQUEAR")).toEqual({ estado: "BLOCKED", publicar: false });
    expect(estadoResultante("OCULTAR")).toEqual({ estado: "HIDDEN", publicar: false });
    expect(estadoResultante("RESTAURAR")).toEqual({ estado: "APPROVED", publicar: true });
  });
});
