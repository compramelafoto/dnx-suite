import { describe, expect, it } from "vitest";
import { STORY_COLLAGES, anclaDelCredito } from "./album-story-collages";

describe("dónde va la etiqueta del fotógrafo en la historia", () => {
  it("cae sobre el crédito en todos los diseños, adentro de la imagen", () => {
    for (const c of STORY_COLLAGES) {
      const a = anclaDelCredito(c.id, "Fotos de @chica.huala");
      expect(a, c.id).not.toBeNull();
      expect(a!.x).toBeGreaterThan(0.05);
      expect(a!.x).toBeLessThan(0.95);
      // El crédito está en la franja de texto de abajo (entre 1300 y 1500 px de 1920).
      expect(a!.y).toBeGreaterThan(0.65);
      expect(a!.y).toBeLessThan(0.8);
    }
  });

  it("en los diseños alineados a la izquierda, el @ queda a la izquierda del centro", () => {
    const izquierda = STORY_COLLAGES.find((c) =>
      c.document.sides[0]!.blocks.some((b) => b.id === "credito" && (b as { align?: string }).align === "left"),
    )!;
    const a = anclaDelCredito(izquierda.id, "Fotos de @chica.huala")!;
    expect(a.x).toBeLessThan(0.5);
  });

  it("sin crédito o con un diseño que no existe, no hay posición", () => {
    expect(anclaDelCredito("no-existe", "Fotos de @x")).toBeNull();
    expect(anclaDelCredito(STORY_COLLAGES[0]!.id, "")).toBeNull();
  });
});
