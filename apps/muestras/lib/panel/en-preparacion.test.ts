import { describe, expect, it } from "vitest";
import { PANEL_SECTIONS } from "@repo/muestras";
import { EN_PREPARACION, MONTAJE_EN_PREPARACION } from "./en-preparacion";

describe("páginas en preparación", () => {
  it("cada sección no construida tiene su explicación", () => {
    for (const s of PANEL_SECTIONS.filter((x) => !x.ready)) {
      const t = EN_PREPARACION[s.key];
      expect(t, s.key).toBeDefined();
      expect(t!.puntos.length).toBeGreaterThan(1);
    }
  });
  it("no explica como futuro algo que ya está construido", () => {
    for (const s of PANEL_SECTIONS.filter((x) => x.ready)) expect(EN_PREPARACION[s.key]).toBeUndefined();
  });
  it("Montaje lista lo que todavía falta", () => expect(MONTAJE_EN_PREPARACION.length).toBeGreaterThan(0));
});
