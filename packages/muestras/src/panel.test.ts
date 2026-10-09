import { describe, expect, it } from "vitest";
import {
  PANEL_SECTIONS, activeSectionKey, countByStatus, groupedPanelSections, panelSections, upcomingSection,
} from "./panel";

describe("secciones del panel", () => {
  it("una persona común ve todo menos Revisión", () => {
    expect(panelSections({ isSuperAdmin: false }).map((s) => s.key)).toEqual([
      "inicio", "muestras", "proponer", "perfil", "convocatorias", "curaduria", "montaje", "ventas", "estadisticas",
    ]);
  });
  it("el super admin ve también Revisión", () => {
    expect(panelSections({ isSuperAdmin: true }).map((s) => s.key)).toContain("revision");
  });
  it("agrupa en el orden de la barra y omite los grupos vacíos", () => {
    expect(groupedPanelSections({ isSuperAdmin: false }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar"]);
    expect(groupedPanelSections({ isSuperAdmin: true }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar", "Administración"]);
  });
  it("están todas las funcionalidades del organizador, construidas o no", () => {
    expect(PANEL_SECTIONS.filter((s) => s.group === "ORGANIZAR").map((s) => s.label)).toEqual([
      "Convocatorias", "Curaduría", "Montaje e impresión", "Ventas", "Estadísticas",
    ]);
  });
  it("cada sección tiene un href único bajo /panel", () => {
    const hrefs = PANEL_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === "/panel" || h.startsWith("/panel/"))).toBe(true);
  });
  it("upcomingSection devuelve sólo las que están en preparación", () => {
    expect(upcomingSection("ventas")?.label).toBe("Ventas");
    expect(upcomingSection("montaje")).toBeNull();
    expect(upcomingSection("revision")).toBeNull();
    expect(upcomingSection("cualquiera")).toBeNull();
  });
});

describe("sección activa", () => {
  it("/panel es Inicio, con o sin barra final", () => {
    expect(activeSectionKey("/panel")).toBe("inicio");
    expect(activeSectionKey("/panel/")).toBe("inicio");
  });
  it("una subruta marca su sección", () => expect(activeSectionKey("/panel/muestras/abc")).toBe("muestras"));
  it("no confunde prefijos", () => expect(activeSectionKey("/panel/muestrasx")).toBeNull());
  it("fuera del panel no hay sección activa", () => expect(activeSectionKey("/m/una-muestra")).toBeNull());
});

describe("resumen por estado", () => {
  it("cuenta cada estado y arranca todos en cero", () => {
    const r = countByStatus([{ reviewStatus: "DRAFT" }, { reviewStatus: "APPROVED" }, { reviewStatus: "APPROVED" }, { reviewStatus: "RARO" }]);
    expect(r).toEqual({ DRAFT: 1, IN_REVIEW: 0, APPROVED: 2, REJECTED: 0, UNPUBLISHED: 0 });
  });
});
