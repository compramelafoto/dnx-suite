import { describe, expect, it } from "vitest";
import { canCoordinateCoverages, canReviewCoverages, transitionNeedsCoordinator } from "./access-policy";

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

/**
 * Empezar a evaluar es trabajo de secretaría: alcanza con revisar. Decidir compromete el
 * tiempo de voluntarios y la palabra de la institución, así que exige coordinar.
 */
describe("transitionNeedsCoordinator", () => {
  it("empezar a evaluar no exige coordinar", () => {
    expect(transitionNeedsCoordinator("EN_EVALUACION")).toBe(false);
  });

  it("aprobar, rechazar y cerrar sí exigen coordinar", () => {
    expect(transitionNeedsCoordinator("APROBADA")).toBe(true);
    expect(transitionNeedsCoordinator("RECHAZADA")).toBe(true);
    expect(transitionNeedsCoordinator("CERRADA")).toBe(true);
  });

  it("las dos cancelaciones también exigen coordinar", () => {
    expect(transitionNeedsCoordinator("CANCELADA_SOLICITANTE")).toBe(true);
    expect(transitionNeedsCoordinator("CANCELADA_ORGANIZACION")).toBe(true);
  });

  it("un estado vacío o inventado también exige coordinar: lo que no se reconoce cae del lado seguro", () => {
    // La función sólo exime al único destino conocido que no compromete nada
    // (`EN_EVALUACION`). Cualquier otra cosa —incluido lo que no es un estado real— tiene
    // que caer del lado que pide coordinar, no del que lo deja pasar.
    expect(transitionNeedsCoordinator("")).toBe(true);
    expect(transitionNeedsCoordinator("ESTADO_INVENTADO")).toBe(true);
  });
});
