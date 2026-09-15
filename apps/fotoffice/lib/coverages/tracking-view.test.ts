import { describe, expect, it } from "vitest";
import { resolveTrackingView } from "./tracking-view";

const ahora = new Date("2026-09-14T12:00:00Z");
const vigente = new Date("2026-12-01T00:00:00Z");
const vencido = new Date("2026-09-01T00:00:00Z");

/**
 * Qué ve quien abre el enlace de seguimiento.
 *
 * Decisión pura, separada de la pantalla, porque acá está lo que importa: que un enlace
 * vencido o revocado no muestre nada, y que responder solo se ofrezca cuando de verdad se
 * pidió algo.
 */
describe("resolveTrackingView", () => {
  it("sin fila, no existe", () => {
    expect(resolveTrackingView(null, ahora)).toEqual({ kind: "NO_EXISTE" });
  });

  it("un enlace vencido no muestra la solicitud", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vencido, tokenRevokedAt: null },
      ahora,
    );
    expect(v.kind).toBe("VENCIDO");
  });

  it("un enlace revocado tampoco, aunque no haya vencido", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: ahora },
      ahora,
    );
    expect(v.kind).toBe("VENCIDO");
  });

  it("con el enlace vigente se ve la solicitud", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(v.kind).toBe("OK");
  });

  it("solo se puede responder cuando se pidió información", () => {
    const pidiendo = resolveTrackingView(
      { status: "REQUIERE_INFO", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(pidiendo).toEqual({ kind: "OK", puedeResponder: true });

    const evaluando = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(evaluando).toEqual({ kind: "OK", puedeResponder: false });
  });

  it("sobre una solicitud rechazada no se responde nada", () => {
    const v = resolveTrackingView(
      { status: "RECHAZADA", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(v).toEqual({ kind: "OK", puedeResponder: false });
  });
});
