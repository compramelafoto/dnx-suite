import { describe, expect, it } from "vitest";

import { computeBubblePosition, isFullyVisible, spotlightBox } from "./placement";

const viewport = { width: 1440, height: 900 };
const bubble = { width: 340, height: 220 };

describe("computeBubblePosition", () => {
  it("pone el globo a la derecha de un panel angosto de la izquierda", () => {
    const pos = computeBubblePosition({ target: { top: 100, left: 0, width: 280, height: 700 }, bubble, viewport });
    expect(pos.side).toBe("right");
    expect(pos.left).toBe(280 + 14);
  });

  it("para una barra superior a lo ancho usa el lado de abajo", () => {
    const pos = computeBubblePosition({ target: { top: 0, left: 0, width: 1440, height: 64 }, bubble, viewport });
    expect(pos.side).toBe("bottom");
    expect(pos.top).toBe(64 + 14);
  });

  it("para un panel a la derecha de todo usa el lado izquierdo", () => {
    const pos = computeBubblePosition({ target: { top: 80, left: 1140, width: 300, height: 600 }, bubble, viewport });
    expect(pos.side).toBe("left");
    expect(pos.left).toBe(1140 - 14 - 340);
  });

  it("una vista 3D a pantalla completa deja el globo centrado encima", () => {
    const pos = computeBubblePosition({ target: { top: 0, left: 0, width: 1440, height: 900 }, bubble, viewport });
    expect(pos.side).toBe("center");
    expect(pos.left).toBe((1440 - 340) / 2);
  });

  it("respeta el lado pedido si entra", () => {
    const pos = computeBubblePosition({
      target: { top: 400, left: 600, width: 200, height: 60 },
      bubble,
      viewport,
      preferred: "top",
    });
    expect(pos.side).toBe("top");
    expect(pos.top).toBe(400 - 14 - 220);
  });

  it("nunca se sale de la pantalla y la flecha apunta al centro de la sección", () => {
    const pos = computeBubblePosition({ target: { top: 860, left: 0, width: 40, height: 30 }, bubble, viewport });
    expect(pos.top + bubble.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(pos.top).toBeGreaterThanOrEqual(12);
    expect(pos.arrowOffset).toBeGreaterThanOrEqual(20);
    expect(pos.arrowOffset).toBeLessThanOrEqual(bubble.height - 20);
  });

  it("sin sección, centrado", () => {
    expect(computeBubblePosition({ target: null, bubble, viewport }).side).toBe("center");
  });
});

describe("spotlightBox", () => {
  it("agrega margen sin salirse de la pantalla", () => {
    expect(spotlightBox({ top: 0, left: 0, width: 100, height: 50 }, 8, viewport)).toEqual({
      top: 4,
      left: 4,
      width: 104,
      height: 54,
    });
  });
});

describe("isFullyVisible", () => {
  it("detecta una sección más abajo del borde", () => {
    expect(isFullyVisible({ top: 850, left: 0, width: 100, height: 100 }, viewport)).toBe(false);
    expect(isFullyVisible({ top: 100, left: 0, width: 100, height: 100 }, viewport)).toBe(true);
  });
});

import { textOnAccent } from "./GuidedTour";

describe("textOnAccent", () => {
  it("usa texto oscuro sobre ámbar claro y blanco sobre naranja o azul oscuros", () => {
    expect(textOnAccent("#ffb547")).toBe("#0f172a");
    expect(textOnAccent("#c2410c")).toBe("#fff");
    expect(textOnAccent("#c27b3d")).toBe("#fff");
    expect(textOnAccent("#0c447c")).toBe("#fff");
  });
});
