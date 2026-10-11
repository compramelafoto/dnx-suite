import { describe, expect, it } from "vitest";
import {
  PANEL_SECTIONS, activeSectionKey, activitySalesHref, countByStatus, groupedPanelSections, panelSections, showActivitySales, upcomingSection,
} from "./panel";

describe("secciones del panel", () => {
  it("una persona común ve todo menos Revisión y las ventas de la plataforma", () => {
    expect(panelSections({ isSuperAdmin: false }).map((s) => s.key)).toEqual([
      "inicio", "muestras", "proponer", "perfil", "envios", "expositor", "cobros", "convocatorias", "concursos", "curaduria", "montaje", "difusion", "ventasMuestras", "estadisticas",
    ]);
  });
  it("el super admin ve también Revisión y las ventas de la plataforma", () => {
    expect(panelSections({ isSuperAdmin: true }).map((s) => s.key)).toContain("revision");
    expect(panelSections({ isSuperAdmin: true }).map((s) => s.key)).toContain("ventas");
  });
  it("agrupa en el orden de la barra y omite los grupos vacíos", () => {
    expect(groupedPanelSections({ isSuperAdmin: false }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar"]);
    expect(groupedPanelSections({ isSuperAdmin: true }).map((g) => g.label)).toEqual(["Tu cuenta", "Para organizar", "Administración"]);
  });
  it("están todas las funcionalidades del organizador, construidas o no", () => {
    expect(PANEL_SECTIONS.filter((s) => s.group === "ORGANIZAR").map((s) => s.label)).toEqual([
      "Convocatorias", "Concursos", "Curaduría", "Montaje e impresión", "Difusión", "Ventas", "Estadísticas",
    ]);
  });
  it("\"Dónde expongo\" está lista, en \"Tu cuenta\", después de \"Mis envíos\"", () => {
    const i = PANEL_SECTIONS.findIndex((s) => s.key === "expositor");
    expect(PANEL_SECTIONS[i]).toMatchObject({ label: "Dónde expongo", href: "/panel/expositor", group: "CUENTA", ready: true });
    expect(PANEL_SECTIONS[i - 1]?.key).toBe("envios");
    expect(upcomingSection("expositor")).toBeNull();
    expect(activeSectionKey("/panel/expositor/abc")).toBe("expositor");
  });
  it("\"Concursos\" está lista, en \"Para organizar\", después de \"Convocatorias\" (etapa 7)", () => {
    const i = PANEL_SECTIONS.findIndex((s) => s.key === "concursos");
    expect(PANEL_SECTIONS[i]).toMatchObject({ label: "Concursos", href: "/panel/concursos", group: "ORGANIZAR", ready: true });
    expect(PANEL_SECTIONS[i - 1]?.key).toBe("convocatorias");
    expect(upcomingSection("concursos")).toBeNull();
    expect(activeSectionKey("/panel/concursos/abc")).toBe("concursos");
  });
  it("cada sección tiene un href único bajo /panel", () => {
    const hrefs = PANEL_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === "/panel" || h.startsWith("/panel/"))).toBe(true);
  });
  it("upcomingSection devuelve sólo las que están en preparación", () => {
    expect(upcomingSection("ventas")).toBeNull();
    expect(upcomingSection("montaje")).toBeNull();
    expect(upcomingSection("estadisticas")).toBeNull();
    expect(upcomingSection("convocatorias")).toBeNull();
    expect(upcomingSection("curaduria")).toBeNull();
    expect(upcomingSection("envios")).toBeNull();
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

describe("Difusión (etapa 5)", () => {
  it("está en Para organizar, lista, en /panel/difusion", () => {
    const d = PANEL_SECTIONS.find((x) => x.key === "difusion");
    expect(d).toMatchObject({ label: "Difusión", href: "/panel/difusion", group: "ORGANIZAR", ready: true, superAdminOnly: false });
    expect(upcomingSection("difusion")).toBeNull();
  });
  it("sus subrutas la marcan activa", () => {
    expect(activeSectionKey("/panel/difusion/x/inauguracion")).toBe("difusion");
  });
});

describe("Venta (etapa 8)", () => {
  it("\"Cobros\" está lista, en \"Tu cuenta\", después de \"Dónde expongo\"", () => {
    const i = PANEL_SECTIONS.findIndex((x) => x.key === "cobros");
    expect(PANEL_SECTIONS[i]).toMatchObject({ label: "Cobros", href: "/panel/cobros", group: "CUENTA", ready: true, superAdminOnly: false });
    expect(PANEL_SECTIONS[i - 1]?.key).toBe("expositor");
    expect(activeSectionKey("/panel/cobros")).toBe("cobros");
  });
  it("las ventas de la plataforma son sólo del super admin", () => {
    expect(PANEL_SECTIONS.find((x) => x.key === "ventas")).toMatchObject({ label: "Ventas de la plataforma", href: "/panel/ventas", group: "ADMIN", ready: true, superAdminOnly: true });
    expect(panelSections({ isSuperAdmin: false }).some((x) => x.key === "ventas")).toBe(false);
  });
  it("\"Ventas\" está a la vista de quien organiza y lleva a la lista de sus muestras", () => {
    expect(PANEL_SECTIONS.find((x) => x.key === "ventasMuestras")).toMatchObject({ label: "Ventas", href: "/panel/ventas-muestras", group: "ORGANIZAR", ready: true, superAdminOnly: false });
    expect(activeSectionKey("/panel/ventas-muestras")).toBe("ventasMuestras");
    expect(activeSectionKey("/panel/ventas")).toBe("ventas");
  });
  it("la venta de cada muestra vive dentro de la muestra", () => {
    expect(activitySalesHref("ck1")).toBe("/panel/muestras/ck1/ventas");
    expect(activeSectionKey(activitySalesHref("ck1"))).toBe("muestras");
    expect(showActivitySales({ canSales: false, canFulfill: true })).toBe(true);
    expect(showActivitySales({ canSales: false, canFulfill: false })).toBe(false);
  });
});
