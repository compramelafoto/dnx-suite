import { describe, expect, it } from "vitest";
import { FOTOFFICE_RESERVED_SLUGS, FOTOFFICE_TOP_LEVEL_APP_ROUTES } from "./reserved-slugs";

describe("FOTOFFICE_RESERVED_SLUGS", () => {
  it("no tiene duplicados", () => {
    expect(new Set(FOTOFFICE_RESERVED_SLUGS).size).toBe(FOTOFFICE_RESERVED_SLUGS.length);
  });

  it("todos son minúsculas, sin espacios (formato de slug válido)", () => {
    for (const slug of FOTOFFICE_RESERVED_SLUGS) {
      expect(slug).toBe(slug.toLowerCase());
      expect(slug).not.toMatch(/\s/);
    }
  });

  it("incluye las rutas reales top-level de la app (auditadas a mano, ver comentario del archivo)", () => {
    for (const route of FOTOFFICE_TOP_LEVEL_APP_ROUTES) {
      expect(FOTOFFICE_RESERVED_SLUGS).toContain(route);
    }
  });

  it("incluye equivalentes español/inglés para las rutas más sensibles", () => {
    expect(FOTOFFICE_RESERVED_SLUGS).toContain("login");
    expect(FOTOFFICE_RESERVED_SLUGS).toContain("iniciar-sesion");
    expect(FOTOFFICE_RESERVED_SLUGS).toContain("configuracion");
    expect(FOTOFFICE_RESERVED_SLUGS).toContain("settings");
  });
});
