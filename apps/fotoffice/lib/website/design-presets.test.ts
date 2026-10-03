import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN_PRESETS,
  getFooterPreset,
  loginButtonText,
  parseWebsiteDesignPresets,
  type FooterPresetId,
  websiteDesignCssVars,
} from "./design-presets";

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

  it("logoSizePx fuera de rango (24-160) cae a default — nunca un tamaño arbitrario", () => {
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
      footerPreset: "simple",
      menuLayout: "drawer",
      menuSide: "left",
      typographyLevels: { title: { font: "playfair-display", size: "xl" }, body: { color: "#112233" } },
    };
    expect(parseWebsiteDesignPresets(full)).toEqual(full);
  });

  it("un sitio guardado antes de que existiera la disposición del menú sigue con la barra superior", () => {
    const viejo = parseWebsiteDesignPresets({ headerPreset: "centered" });
    expect(viejo.menuLayout).toBe("topbar");
    expect(viejo.menuSide).toBe("right");
  });

  it("una disposición desconocida cae a la barra superior", () => {
    expect(parseWebsiteDesignPresets({ menuLayout: "carrusel" }).menuLayout).toBe("topbar");
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

describe("footerPreset", () => {
  it("un objeto vacío cae al pie 'simple'", () => {
    expect(parseWebsiteDesignPresets({}).footerPreset).toBe("simple");
  });

  it("un footerPreset inválido cae al default en vez de romper", () => {
    expect(parseWebsiteDesignPresets({ footerPreset: "neon" }).footerPreset).toBe("simple");
  });

  it("un footerPreset válido se conserva", () => {
    expect(parseWebsiteDesignPresets({ footerPreset: "columns" }).footerPreset).toBe("columns");
  });

  it("getFooterPreset devuelve la definición pedida", () => {
    expect(getFooterPreset("full").id).toBe("full");
  });

  it("getFooterPreset cae a la primera definición si el id no existe", () => {
    expect(getFooterPreset("no-existe" as FooterPresetId).id).toBe("simple");
  });
});

describe("loginButtonText", () => {
  it("sin texto elegido dice Ingresar", () => {
    expect(loginButtonText(DEFAULT_DESIGN_PRESETS)).toBe("Ingresar");
    expect(loginButtonText({ loginButtonLabel: "" })).toBe("Ingresar");
    expect(loginButtonText({ loginButtonLabel: "   " })).toBe("Ingresar");
  });

  it('el viejo "Iniciar sesión" que quedó guardado por defecto pasa a Ingresar', () => {
    expect(loginButtonText({ loginButtonLabel: "Iniciar sesión" })).toBe("Ingresar");
  });

  it("un texto propio se respeta", () => {
    expect(loginButtonText({ loginButtonLabel: " Entrar " })).toBe("Entrar");
    expect(loginButtonText({ loginButtonLabel: "Soy socio" })).toBe("Soy socio");
  });
});
