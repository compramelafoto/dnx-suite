import { describe, expect, it } from "vitest";
import { canCoordinateCoverages, canReviewCoverages } from "./access-policy";

/**
 * Dos niveles y no uno: evaluar una solicitud y aprobarla son cosas distintas.
 *
 * Quien revisa puede leer la bandeja, dejar notas y pedir información — trabajo de secretaría
 * que no compromete nada. Aprobar, rechazar y asignar gente mueven plata ajena y el tiempo de
 * voluntarios, así que piden rol de administración.
 */
describe("canCoordinateCoverages", () => {
  it("el dueño y el administrador coordinan", () => {
    expect(canCoordinateCoverages("WORKSPACE_OWNER")).toBe(true);
    expect(canCoordinateCoverages("WORKSPACE_ADMIN")).toBe(true);
  });

  it("acepta el ADMIN legacy, que todavía llega de la tabla vieja", () => {
    expect(canCoordinateCoverages("ADMIN")).toBe(true);
  });

  it("STAFF no coordina", () => {
    expect(canCoordinateCoverages("STAFF")).toBe(false);
  });

  it("sin rol, no", () => {
    expect(canCoordinateCoverages(null)).toBe(false);
    expect(canCoordinateCoverages(undefined)).toBe(false);
    expect(canCoordinateCoverages("")).toBe(false);
  });

  it("no acepta valores que no existen en la base", () => {
    expect(canCoordinateCoverages("COORDINADOR")).toBe(false);
    expect(canCoordinateCoverages("workspace_owner")).toBe(false);
  });
});

describe("canReviewCoverages", () => {
  it("STAFF revisa", () => {
    expect(canReviewCoverages("STAFF")).toBe(true);
  });

  it("quien coordina también revisa", () => {
    expect(canReviewCoverages("WORKSPACE_OWNER")).toBe(true);
    expect(canReviewCoverages("WORKSPACE_ADMIN")).toBe(true);
    expect(canReviewCoverages("ADMIN")).toBe(true);
  });

  it("sin rol en el workspace, no se revisa nada", () => {
    expect(canReviewCoverages(null)).toBe(false);
  });
});
