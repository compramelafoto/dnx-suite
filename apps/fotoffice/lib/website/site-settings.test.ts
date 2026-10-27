import { describe, expect, it } from "vitest";
import {
  buildTrackingScripts,
  DEFAULT_SITE_SETTINGS,
  isTrackingExcludedPath,
  keepSiteSettings,
  keywordsFromText,
  parseWebsiteSiteSettings,
  validateSiteSettingsInput,
  withSiteSettings,
  type WebsiteSiteSettings,
} from "./site-settings";
import { parseWebsiteDesignPresets, websiteDesignPresetsSchema } from "./design-presets";
import { parseWebsiteSections } from "./blocks";
import sfprSections from "./__fixtures__/sfpr-sections.json";

const valido: WebsiteSiteSettings = {
  seo: { keywords: ["fotografía", "bodas"], shareImageUrl: "https://cdn.test/compartir.jpg", googleVerification: "abcDEF_123-xyz" },
  analytics: { ga4Id: "G-ABC123XYZ", metaPixelId: "1551456739072627" },
  whatsappButton: {
    enabled: true,
    number: "341 341-9869",
    welcomeMessage: "Hola como podemos ayudarte",
    chatText: "Hola, vi el sitio",
    side: "right",
    size: "md",
  },
  socialLinks: [
    { network: "facebook", url: "https://facebook.com/dnx" },
    { network: "flickr", url: "https://flickr.com/photos/dnx" },
  ],
  photoProtection: { enabled: true },
};

describe("parseWebsiteSiteSettings (lectura tolerante)", () => {
  it("un sitio viejo sin ajustes (null, {}, diseño sin la clave) da los defaults", () => {
    expect(parseWebsiteSiteSettings(null)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(parseWebsiteSiteSettings({})).toEqual(DEFAULT_SITE_SETTINGS);
    expect(parseWebsiteSiteSettings({ headerPreset: "centered", footerPreset: "columns" })).toEqual(DEFAULT_SITE_SETTINGS);
    expect(parseWebsiteSiteSettings("basura")).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it("lee bien unos ajustes válidos", () => {
    expect(parseWebsiteSiteSettings({ siteSettings: valido })).toEqual(valido);
  });

  it("un campo roto cae a su default sin llevarse los demás", () => {
    const r = parseWebsiteSiteSettings({
      siteSettings: {
        ...valido,
        analytics: { ga4Id: "UA-12345-1", metaPixelId: "<script>" },
        seo: { keywords: "no es lista", shareImageUrl: "javascript:alert(1)", googleVerification: '<meta name="x">' },
        whatsappButton: { ...valido.whatsappButton, side: "arriba", size: 99 },
        socialLinks: [{ network: "myspace", url: "https://x" }, { network: "x", url: "http://inseguro" }, { network: "x", url: "https://x.com/dnx" }],
        photoProtection: "sí",
      },
    });
    expect(r.analytics).toEqual({ ga4Id: null, metaPixelId: null });
    expect(r.seo).toEqual({ keywords: [], shareImageUrl: null, googleVerification: null });
    expect(r.whatsappButton.side).toBe("right");
    expect(r.whatsappButton.size).toBe("md");
    expect(r.whatsappButton.number).toBe("341 341-9869");
    expect(r.socialLinks).toEqual([{ network: "x", url: "https://x.com/dnx" }]);
    expect(r.photoProtection.enabled).toBe(false);
  });
});

describe("validateSiteSettingsInput (al guardar)", () => {
  it("acepta lo válido y normaliza el GA4 a mayúsculas", () => {
    const r = validateSiteSettingsInput({ ...valido, analytics: { ga4Id: " g-abc123xyz ", metaPixelId: "1551456739072627" } });
    expect("settings" in r && r.settings.analytics.ga4Id).toBe("G-ABC123XYZ");
  });

  it.each([
    [{ analytics: { ga4Id: "UA-1234-1" } }, /G-/],
    [{ analytics: { metaPixelId: "abc123" } }, /número/],
    [{ seo: { googleVerification: '<meta name="google-site-verification" content="x">' } }, /verificación/],
    [{ seo: { shareImageUrl: "http://sin-https.test/a.jpg" } }, /https/],
    [{ whatsappButton: { enabled: true, number: "12" } }, /número válido/],
    [{ socialLinks: [{ network: "facebook", url: "facebook.com/dnx" }] }, /Facebook/],
    [{ socialLinks: [{ network: "myspace", url: "https://myspace.com" }] }, /redes/],
  ])("rechaza %j con un mensaje claro", (input, msg) => {
    const r = validateSiteSettingsInput(input);
    expect("error" in r && r.error).toMatch(msg);
  });

  it("limita las palabras clave y descarta las repetidas", () => {
    expect(keywordsFromText("Bodas, bodas ,  quince   años,,")).toEqual(["Bodas", "quince años"]);
    const muchas = Array.from({ length: 21 }, (_, i) => `k${i}`);
    expect("error" in validateSiteSettingsInput({ seo: { keywords: muchas } })).toBe(true);
  });

  it("el botón apagado no exige número; un enlace de red vacío se ignora", () => {
    const r = validateSiteSettingsInput({ whatsappButton: { enabled: false, number: "" }, socialLinks: [{ network: "x", url: "  " }] });
    expect("settings" in r && r.settings.socialLinks).toEqual([]);
  });
});

describe("withSiteSettings / keepSiteSettings", () => {
  const diseño = { headerPreset: "centered", footerPreset: "columns" };

  it("guardar ajustes no toca el resto del diseño", () => {
    const json = withSiteSettings(diseño, valido);
    expect(json).toMatchObject(diseño);
    expect(parseWebsiteDesignPresets(json).headerPreset).toBe("centered");
    expect(parseWebsiteSiteSettings(json)).toEqual(valido);
  });

  it("el autoguardado del constructor conserva los ajustes que ya estaban", () => {
    const enBase = withSiteSettings(diseño, valido);
    // El constructor manda su diseño parseado, que no conoce `siteSettings`.
    const delConstructor = websiteDesignPresetsSchema.parse({ ...diseño, headerPreset: "minimal" });
    const final = keepSiteSettings(delConstructor, enBase);
    expect(final.headerPreset).toBe("minimal");
    expect(parseWebsiteSiteSettings(final)).toEqual(valido);
  });

  it("sin ajustes previos no inventa la clave", () => {
    expect(keepSiteSettings({ headerPreset: "minimal" }, diseño)).not.toHaveProperty("siteSettings");
  });
});

describe("buildTrackingScripts", () => {
  it("sin IDs no arma nada", () => {
    expect(buildTrackingScripts(DEFAULT_SITE_SETTINGS.analytics)).toEqual([]);
  });

  it("GA4: carga gtag del host de Google y configura el ID", () => {
    const s = buildTrackingScripts({ ga4Id: "G-ABC123XYZ", metaPixelId: null });
    expect(s[0].src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ");
    expect(s[1].inline).toContain(`gtag('config',"G-ABC123XYZ")`);
  });

  it("píxel: el número va como texto JSON y dispara PageView", () => {
    const [pixel] = buildTrackingScripts({ ga4Id: null, metaPixelId: "1551456739072627" });
    expect(pixel.inline).toContain(`fbq('init',"1551456739072627")`);
    expect(pixel.inline).toContain("https://connect.facebook.net/en_US/fbevents.js");
  });

  it("un ID que no cumple el formato nunca llega al script", () => {
    expect(buildTrackingScripts({ ga4Id: "G-1');alert(1);//", metaPixelId: "1');x('" })).toEqual([]);
  });
});

describe("isTrackingExcludedPath", () => {
  it.each([
    ["/w/dnx/pedido/abc123", true],
    ["/pedido/abc123", true],
    ["/w/dnx/galeria/tok/descargas", true],
    ["/obras/permiso/tok", true],
    ["/w/dnx/tienda/pedido/xyz", true],
    ["/w/dnx", false],
    ["/w/dnx/blog/un-articulo", false],
    ["/presupuesto", false],
    ["/tienda/una-remera", false],
  ])("%s → %s", (path, excluida) => {
    expect(isTrackingExcludedPath(path)).toBe(excluida);
  });
});

describe("sitios viejos", () => {
  it("el sectionsJson de SFPR se sigue leyendo igual (sin ajustes por página)", () => {
    const s = parseWebsiteSections(sfprSections);
    expect(s.pages.home.length).toBeGreaterThan(0);
    for (const meta of Object.values(s.pageMeta)) {
      expect(meta.shareImageUrl).toBeUndefined();
      expect(meta.hideFromSearch).toBeUndefined();
    }
  });
});
