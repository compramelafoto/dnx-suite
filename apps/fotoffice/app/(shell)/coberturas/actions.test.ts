import { describe, expect, it } from "vitest";
import { planStatusChange } from "@/lib/coverages/status-change-plan";

/**
 * Lo que la acción decide antes de escribir.
 *
 * Tres controles, y el orden importa: primero que la solicitud sea de este workspace, después
 * que la transición exista, y recién ahí que haya motivo si hace falta. Al revés, un mensaje
 * de «falta el motivo» sobre una solicitud ajena ya confirmaría que esa solicitud existe.
 */
describe("planStatusChange", () => {
  const solicitud = { id: "req-1", workspaceId: "ws-a", status: "EN_EVALUACION" };

  it("una solicitud de otro workspace no existe para esta persona", () => {
    const r = planStatusChange({
      solicitud: null,
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No encontramos");
  });

  it("no se filtra que existe pidiendo el motivo primero", () => {
    const r = planStatusChange({
      solicitud: null,
      workspaceId: "ws-a",
      to: "RECHAZADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain("motivo");
  });

  it("una transición inválida se rechaza", () => {
    const r = planStatusChange({
      solicitud: { ...solicitud, status: "RECHAZADA" },
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
  });

  it("rechazar sin motivo no pasa", () => {
    const r = planStatusChange({
      solicitud,
      workspaceId: "ws-a",
      to: "RECHAZADA",
      reason: "  ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("aprobar pasa y devuelve de dónde venía, para el historial", () => {
    const r = planStatusChange({
      solicitud,
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r).toEqual({ ok: true, from: "EN_EVALUACION", to: "APROBADA" });
  });
});
