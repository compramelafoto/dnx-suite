import { describe, expect, it } from "vitest";
import { decidirLimites, MENSAJE_DIARIO, MENSAJE_TOPE } from "./limites";

const L = { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 15_000_000, workspaceMonthlyCapMicroUsd: 10_000_000 };
const libre = { mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 };

describe("decidirLimites", () => {
  it("debajo de todos los topes deja pasar", () => {
    expect(decidirLimites(L, { mensajesHoyPersona: 59, gastoMesGlobal: 14_999_999, gastoMesWorkspace: 9_999_999 })).toEqual({ permitido: true });
  });
  it("el tope global corta justo al llegar", () => {
    expect(decidirLimites(L, { ...libre, gastoMesGlobal: 15_000_000 })).toEqual({ permitido: false, motivo: "tope_global", mensaje: MENSAJE_TOPE });
  });
  it("el tope del workspace corta justo al llegar", () => {
    expect(decidirLimites(L, { ...libre, gastoMesWorkspace: 10_000_000 })).toEqual({ permitido: false, motivo: "tope_workspace", mensaje: MENSAJE_TOPE });
  });
  it("60 mensajes en el día cortan a la persona", () => {
    expect(decidirLimites(L, { ...libre, mensajesHoyPersona: 60 })).toEqual({ permitido: false, motivo: "diario", mensaje: MENSAJE_DIARIO });
  });
  it("orden: global, workspace, diario", () => {
    const todo = { mensajesHoyPersona: 99, gastoMesGlobal: 99_000_000, gastoMesWorkspace: 99_000_000 };
    expect(decidirLimites(L, todo)).toMatchObject({ motivo: "tope_global" });
    expect(decidirLimites(L, { ...todo, gastoMesGlobal: 0 })).toMatchObject({ motivo: "tope_workspace" });
  });
  it("un tope en 0 es sin tope", () => {
    const sinTopes = { ...L, monthlyCapMicroUsd: 0, workspaceMonthlyCapMicroUsd: 0 };
    expect(decidirLimites(sinTopes, { mensajesHoyPersona: 0, gastoMesGlobal: 1e12, gastoMesWorkspace: 1e12 })).toEqual({ permitido: true });
  });
  it("ningún mensaje ofrece hablar con una persona (FOTOFFICE no tiene tickets del bot)", () => {
    expect(MENSAJE_TOPE).not.toMatch(/persona/i);
    expect(MENSAJE_DIARIO).not.toMatch(/persona/i);
    expect(MENSAJE_TOPE).toMatch(/formulario de siempre/);
  });
});
