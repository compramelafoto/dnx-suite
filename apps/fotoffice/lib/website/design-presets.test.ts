import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_PRESETS, parseWebsiteDesignPresets, websiteDesignCssVars } from "./design-presets";

describe("parseWebsiteDesignPresets", () => {
  it("null/undefined/no-objeto cae a DEFAULT_DESIGN_PRESETS completo", () => {
    expect(parseWebsiteDesignPresets(null)).toEqual(DEFAULT_DESIGN_PRESETS);
    expect(parseWebsiteDesignPresets(undefined)).toEqual(DEFAULT_DESIGN_PRESETS);
    expect(parseWebsiteDesignPresets("no soy un objeto")).toEqual(DEFAULT_DESIGN_PRESETS);
  });

  it("{} cae a defaults campo por campo (no explota, no exige todos los campos)", () => {
    expect(parseWebsiteDesignPresets({})).toEqual(DEFAULT_DESIGN_PRESETS);
  });

  it("un campo con un id que no existe en el catálogo cae a su default individual, sin tirar el resto", () => {
    const result = parseWebsiteDesignPresets({ headerPreset: "no-existe", buttonPreset: "pill" });
    expect(result.headerPreset).toBe(DEFAULT_DESIGN_PRESETS.headerPreset);
    expect(result.buttonPreset).toBe("pill");
  });

  it("logoSizePx fuera de rango (24-96) cae a default — nunca un tamaño arbitrario", () => {
    expect(parseWebsiteDesignPresets({ logoSizePx: 500 }).logoSizePx).toBe(DEFAULT_DESIGN_PRESETS.logoSizePx);
    expect(parseWebsiteDesignPresets({ logoSizePx: 1 }).logoSizePx).toBe(DEFAULT_DESIGN_PRESETS.logoSizePx);
    expect(parseWebsiteDesignPresets({ logoSizePx: 60 }).logoSizePx).toBe(60);
  });

  it("un objeto completo y válido se conserva tal cual", () => {
    const full = {
      headerPreset: "centered",
      showLoginButton: true,
      loginButtonLabel: "Entrar",
      logoSizePx: 64,
      typographyPreset: "editorial",
      buttonPreset: "pill",
      animationPreset: "dynamic",
    };
    expect(parseWebsiteDesignPresets(full)).toEqual(full);
  });
});

describe("websiteDesignCssVars", () => {
  it("devuelve variables CSS para tipografía, botones y tamaño de logo — nunca CSS libre", () => {
    const vars = websiteDesignCssVars(DEFAULT_DESIGN_PRESETS);
    expect(vars["--wsite-logo-size"]).toBe("40px");
    expect(vars["--wsite-button-radius"]).toBe("0.5rem");
    expect(typeof vars["--wsite-heading-font"]).toBe("string");
  });
});
