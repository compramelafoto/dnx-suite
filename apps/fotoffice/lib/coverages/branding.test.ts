import { describe, expect, it } from "vitest";
import {
  colorConAlfa,
  colorDeTextoSobre,
  contrastRatio,
  parseHexColor,
  relativeLuminance,
  resolveCoverageBrand,
  TEXTO_CLARO,
  TEXTO_OSCURO,
} from "./branding";

describe("parseHexColor", () => {
  it("acepta las formas en que la gente escribe un color", () => {
    expect(parseHexColor("#0ea5e9")).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseHexColor("0ea5e9")).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseHexColor("  #0EA5E9  ")).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("lo que no es un color devuelve null, no un negro inventado", () => {
    // `null` deja que la pantalla siga con el estilo de siempre. Un negro por omisión se vería
    // como una decisión de la institución y nadie sabría de dónde salió.
    expect(parseHexColor(null)).toBe(null);
    expect(parseHexColor(undefined)).toBe(null);
    expect(parseHexColor("")).toBe(null);
    expect(parseHexColor("   ")).toBe(null);
    expect(parseHexColor("azul")).toBe(null);
    expect(parseHexColor("#12345")).toBe(null);
    expect(parseHexColor("rgb(1,2,3)")).toBe(null);
  });
});

describe("relativeLuminance", () => {
  it("va de 0 en el negro a 1 en el blanco", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("negro contra blanco es 21, un color contra sí mismo es 1", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 2);
    expect(contrastRatio({ r: 14, g: 165, b: 233 }, { r: 14, g: 165, b: 233 })).toBeCloseTo(1, 5);
  });
});

/**
 * El caso que justifica todo el archivo: una institución con un amarillo claro.
 *
 * Sin este resguardo, el botón de enviar queda con texto blanco sobre amarillo y no se lee. La
 * institución no se entera: ella ve su panel, no la pantalla que abre la ONG desde el teléfono.
 */
describe("colorDeTextoSobre", () => {
  it("un fondo claro lleva texto negro", () => {
    expect(colorDeTextoSobre("#ffd400")).toBe(TEXTO_OSCURO); // amarillo
    expect(colorDeTextoSobre("#ffffff")).toBe(TEXTO_OSCURO);
    expect(colorDeTextoSobre("#a7f3d0")).toBe(TEXTO_OSCURO); // verde agua
  });

  it("un fondo oscuro lleva texto blanco", () => {
    expect(colorDeTextoSobre("#0f172a")).toBe(TEXTO_CLARO);
    expect(colorDeTextoSobre("#000000")).toBe(TEXTO_CLARO);
    expect(colorDeTextoSobre("#7f1d1d")).toBe(TEXTO_CLARO); // bordó
  });

  it("la elección siempre es la de mayor contraste", () => {
    for (const color of ["#ffd400", "#0f172a", "#0ea5e9", "#808080", "#767676"]) {
      const rgb = parseHexColor(color)!;
      const elegido = colorDeTextoSobre(color)!;
      const elegidoRgb = parseHexColor(elegido)!;
      const otroRgb = parseHexColor(elegido === TEXTO_CLARO ? TEXTO_OSCURO : TEXTO_CLARO)!;
      expect(contrastRatio(rgb, elegidoRgb)).toBeGreaterThanOrEqual(contrastRatio(rgb, otroRgb));
    }
  });

  it("sin color no decide nada", () => {
    expect(colorDeTextoSobre(null)).toBe(null);
    expect(colorDeTextoSobre("no es un color")).toBe(null);
  });
});

describe("colorConAlfa", () => {
  it("devuelve el mismo color con transparencia", () => {
    expect(colorConAlfa("#0ea5e9", 0.12)).toBe("rgba(14, 165, 233, 0.12)");
  });

  it("sin color no inventa nada", () => {
    expect(colorConAlfa("bordó", 0.12)).toBe(null);
  });
});

describe("resolveCoverageBrand", () => {
  it("resuelve el color, su texto legible y el acento", () => {
    const marca = resolveCoverageBrand({ primaryColor: "#0F172A", accentColor: "#f59e0b" });
    expect(marca).toEqual({
      primary: "#0f172a",
      onPrimary: TEXTO_CLARO,
      soft: "rgba(15, 23, 42, 0.12)",
      accent: "#f59e0b",
    });
  });

  it("sin acento usable cae en el color principal", () => {
    const marca = resolveCoverageBrand({ primaryColor: "#ffd400", accentColor: null });
    expect(marca?.accent).toBe("#ffd400");
    expect(marca?.onPrimary).toBe(TEXTO_OSCURO);
  });

  it("sin color principal no hay marca: la pantalla sigue con el estilo de siempre", () => {
    // Una institución que nunca cargó colores tiene que ver el formulario entero y legible.
    expect(resolveCoverageBrand(null)).toBe(null);
    expect(resolveCoverageBrand({ primaryColor: null, accentColor: "#f59e0b" })).toBe(null);
    expect(resolveCoverageBrand({ primaryColor: "verde" })).toBe(null);
  });
});
