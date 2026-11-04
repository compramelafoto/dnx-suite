import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN_PRESETS,
  parseWebsiteDesignPresets,
  resolvedTypography,
  websiteDesignCssVars,
  websiteFontsHref,
} from "./design-presets";
import { compactTypographyLevels, FONT_OPTIONS, getFont, googleFontsHref, localFontsUsed, nearestWeight, TYPOGRAPHY_LEVELS, typographyLevelsSchema } from "./typography";

describe("tipografía por niveles", () => {
  it("sin cambios, las variables viejas valen lo mismo que antes (los sitios publicados no cambian)", () => {
    const vars = websiteDesignCssVars({ ...DEFAULT_DESIGN_PRESETS, typographyPreset: "institutional" });
    expect(vars["--wsite-heading-font"]).toBe("Georgia, 'Times New Roman', serif");
    expect(vars["--wsite-body-font"]).toBe("-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");
    expect(vars["--wsite-heading-weight"]).toBe("700");
    expect(vars["--wsite-button-weight"]).toBe("600");
  });

  it("los estilos de partida sólo usan letras del sistema: no se descarga nada", () => {
    for (const typographyPreset of ["institutional", "modern", "editorial", "contemporary", "photographic"] as const) {
      expect(websiteFontsHref({ ...DEFAULT_DESIGN_PRESETS, typographyPreset })).toBeNull();
    }
  });

  it("un cambio en un nivel no toca los demás", () => {
    const t = resolvedTypography({ ...DEFAULT_DESIGN_PRESETS, typographyLevels: { title: { font: "playfair-display", size: "xl" } } });
    expect(t.title).toMatchObject({ font: "playfair-display", size: "xl" });
    expect(t.heading.font).toBe("system-sans");
  });

  it("el grosor se ajusta a lo que trae la letra", () => {
    expect(nearestWeight(getFont("bebas-neue"), 700)).toBe(400);
    const t = resolvedTypography({ ...DEFAULT_DESIGN_PRESETS, typographyLevels: { title: { font: "bebas-neue" } } });
    expect(t.title.weight).toBe(400);
  });

  it("Google Fonts pide sólo las letras y grosores usados, una vez cada una", () => {
    const href = websiteFontsHref({
      ...DEFAULT_DESIGN_PRESETS,
      typographyLevels: {
        title: { font: "playfair-display", weight: 700 },
        heading: { font: "playfair-display", weight: 700 },
        body: { font: "lora" },
      },
    });
    expect(href).toBe("https://fonts.googleapis.com/css2?family=Lora:wght@400&family=Playfair+Display:wght@700&display=swap");
  });

  it("colores: de la paleta por nombre, o un hex; nada más", () => {
    const vars = websiteDesignCssVars({
      ...DEFAULT_DESIGN_PRESETS,
      typographyLevels: { heading: { color: "accent" }, body: { color: "#112233" } },
    });
    expect(vars["--wsite-heading-color"]).toBe("var(--wsite-accent)");
    expect(vars["--wsite-body-color"]).toBe("#112233");
    const malo = parseWebsiteDesignPresets({ typographyLevels: { body: { color: "red; background: url(x)" } } });
    expect(malo.typographyLevels.body).toBeUndefined();
  });

  it("un campo inválido se descarta sin perder el resto del nivel", () => {
    const parsed = typographyLevelsSchema.parse({ title: { font: "no-existe", size: "lg" }, otra: 1 });
    expect(compactTypographyLevels(parsed)).toEqual({ title: { size: "lg" } });
  });

  it("mayúsculas por nivel", () => {
    const vars = websiteDesignCssVars({ ...DEFAULT_DESIGN_PRESETS, typographyLevels: { menu: { uppercase: true } } });
    expect(vars["--wsite-menu-transform"]).toBe("uppercase");
    expect(vars["--wsite-body-transform"]).toBe("none");
  });
});

/** Los seis niveles con la misma letra: así se prueba la letra sin depender del estilo de partida. */
function nivelesTodosCon(font: string) {
  const levels = Object.fromEntries(TYPOGRAPHY_LEVELS.map((l) => [l.id, { font }]));
  return resolvedTypography({ ...DEFAULT_DESIGN_PRESETS, typographyLevels: levels });
}

describe("DejaVu Sans (letra del manual de SOYBELUZ)", () => {
  it("está en el catálogo como letra local, no de Google", () => {
    const f = getFont("dejavu-sans");
    expect(f.id).toBe("dejavu-sans");
    expect(f.google).toBeNull();
    expect(f.local).toBe("dejavu-sans");
    expect(f.weights).toEqual([400, 700]);
    expect(f.stack.startsWith("var(--font-dejavu-sans)")).toBe(true);
  });

  it("no pide nada a Google Fonts", () => {
    expect(googleFontsHref(nivelesTodosCon("dejavu-sans"))).toBeNull();
  });

  it("localFontsUsed la detecta sólo cuando algún nivel la usa", () => {
    expect(localFontsUsed(nivelesTodosCon("dejavu-sans"))).toEqual(["dejavu-sans"]);
    expect(localFontsUsed(nivelesTodosCon("inter"))).toEqual([]);
    expect(localFontsUsed(resolvedTypography(DEFAULT_DESIGN_PRESETS))).toEqual([]);
  });

  it("todas las opciones que ya existían siguen sin letra local", () => {
    expect(FONT_OPTIONS.filter((f) => f.local !== null).map((f) => f.id)).toEqual(["dejavu-sans"]);
  });
});
