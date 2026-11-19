import { describe, expect, it } from "vitest";
import { incidenteDeTope } from "./aviso-tope";

const NOV = new Date("2026-11-18T19:29:00.000Z");

describe("incidenteDeTope", () => {
  it("el tope del estudio es urgente (va a Telegram) y lleva el mes para avisar una vez por mes", () => {
    const i = incidenteDeTope("tope_workspace", NOV);
    expect(i.codigo).toBe("tope_workspace_2026-11");
    expect(i.urgente).toBe(true);
    expect(i.detalle).toContain("FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD");
    expect(i.detalle).toContain("pasan a una persona");
  });

  it("el tope general también avisa, con su propia variable", () => {
    const i = incidenteDeTope("tope_global", NOV);
    expect(i).toMatchObject({ codigo: "tope_global_2026-11", urgente: true });
    expect(i.detalle).toContain("FOTOFFICE_BOT_MONTHLY_CAP_USD");
  });

  it("el mes se corta en hora argentina", () => {
    expect(incidenteDeTope("tope_workspace", new Date("2026-12-01T02:00:00.000Z")).codigo).toBe("tope_workspace_2026-11");
  });

  it("el tope diario de un chat no molesta a nadie", () => {
    expect(incidenteDeTope("diario", NOV)).toEqual({ codigo: "tope_diario", urgente: false, detalle: "diario" });
  });
});
