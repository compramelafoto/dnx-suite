import { describe, expect, it } from "vitest";
import { transitionNeedsCoordinator } from "./access-policy";

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
