import { describe, expect, it } from "vitest";
import { websiteBlockSchema, websitePageMetaSchema, type WebsiteBlockType } from "./blocks";
import { websiteDesignPresetsSchema } from "./design-presets";
import { HOME_PAGE_KEY, validatePageSlug } from "./pages";
import { siteMenuSchema } from "./site-menu";
import { MAX_CUSTOM_PAGES } from "./save-pages";
import { SITE_TEMPLATE_IDS, WEBSITE_TEMPLATES, getWebsiteTemplate, resolveTemplateId } from "./templates";
import { FOTOS_DE_MUESTRA } from "./templates/fotos";

const tipos = (id: string, clave: string): WebsiteBlockType[] =>
  getWebsiteTemplate(id)!.paginas.find((p) => p.clave === clave)!.bloques.map((b) => b.type);

describe("WEBSITE_TEMPLATES", () => {
  it("son las cinco plantillas, en este orden", () => {
    expect(WEBSITE_TEMPLATES.map((t) => t.id)).toEqual(["eventos", "estudio", "retrato-editorial", "oscura", "institucion"]);
    expect([...SITE_TEMPLATE_IDS]).toEqual(WEBSITE_TEMPLATES.map((t) => t.id));
  });

  it("cada bloque de cada página parsea con el schema vigente, sin que el parseo le cambie nada", () => {
    for (const template of WEBSITE_TEMPLATES) {
      for (const pagina of template.paginas) {
        expect(pagina.bloques.length).toBeGreaterThan(0);
        for (const block of pagina.bloques) {
          const parsed = websiteBlockSchema.safeParse(block);
          expect(parsed.success, `${template.id}/${pagina.clave}/${block.type}`).toBe(true);
          // Un `.catch` o un `transform` que corrija algo en silencio sería un dato de muestra roto.
          expect(parsed.data).toEqual(block);
        }
      }
    }
  });

  it("en cada página los ids son únicos y el orden va de 0 en adelante", () => {
    for (const template of WEBSITE_TEMPLATES) {
      for (const pagina of template.paginas) {
        const ids = new Set(pagina.bloques.map((b) => b.id));
        expect(ids.size).toBe(pagina.bloques.length);
        expect(pagina.bloques.map((b) => b.order)).toEqual(pagina.bloques.map((_, i) => i));
      }
    }
  });

  it("la primera página es la portada, sin meta; las demás tienen meta y una dirección válida y única", () => {
    for (const template of WEBSITE_TEMPLATES) {
      const [portada, ...propias] = template.paginas;
      expect(portada.clave).toBe(HOME_PAGE_KEY);
      expect(portada.meta).toBeUndefined();
      expect(propias.length).toBeLessThanOrEqual(MAX_CUSTOM_PAGES);
      const claves = new Set(template.paginas.map((p) => p.clave));
      expect(claves.size).toBe(template.paginas.length);
      for (const pagina of propias) {
        expect(pagina.clave).toMatch(/^[a-z0-9][a-z0-9_]{0,39}$/);
        expect(websitePageMetaSchema.safeParse(pagina.meta).success).toBe(true);
        const otros = propias.filter((p) => p !== pagina).map((p) => p.meta!.slug);
        expect(validatePageSlug(pagina.meta!.slug, otros), `${template.id}/${pagina.meta!.slug}`).toBeNull();
      }
    }
  });

  it("el diseño y el menú son válidos, y el menú sólo apunta a páginas de la plantilla", () => {
    for (const template of WEBSITE_TEMPLATES) {
      expect(websiteDesignPresetsSchema.parse(template.design)).toEqual(template.design);
      expect(siteMenuSchema.safeParse(template.menu).success).toBe(true);
      const claves = new Set(template.paginas.map((p) => p.clave));
      for (const item of template.menu.items) {
        if (item.kind === "custom") expect(claves.has(item.pageKey)).toBe(true);
      }
    }
  });

  it("los colores sugeridos, cuando hay, son hexadecimales de 6 dígitos", () => {
    for (const template of WEBSITE_TEMPLATES) {
      if (!template.coloresSugeridos) continue;
      for (const valor of Object.values(template.coloresSugeridos)) expect(valor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("las fotos de muestra salen sólo de la lista con créditos, nunca de clientes", () => {
    const permitidas = new Set(Object.values(FOTOS_DE_MUESTRA).map((f) => f.url));
    for (const template of WEBSITE_TEMPLATES) {
      const json = JSON.stringify(template.paginas);
      const urls = json.match(/https:\/\/images\.unsplash\.com\/[^"]+/g) ?? [];
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(permitidas.has(url)).toBe(true);
      // Ninguna foto de un bucket de clientes (R2 de FOTOFFICE / CompraMeLaFoto).
      expect(json).not.toMatch(/r2\.dev|r2\.cloudflarestorage/);
    }
  });

  it("los textos de muestra dicen «dinero», nunca «plata»", () => {
    for (const template of WEBSITE_TEMPLATES) {
      expect(JSON.stringify(template).toLowerCase()).not.toMatch(/\bplata\b/);
    }
  });

  it("cada plantilla trae las páginas y bloques que pide el plan", () => {
    expect(tipos("eventos", "home")).toEqual(["HERO", "PORTFOLIO", "RICH_TEXT", "TESTIMONIALS", "INQUIRY_FORM"]);
    const heroEventos = getWebsiteTemplate("eventos")!.paginas[0].bloques[0];
    expect(heroEventos.type === "HERO" && heroEventos.config.heightPreset).toBe("screen");
    expect(getWebsiteTemplate("eventos")!.paginas.map((p) => p.meta?.slug)).toEqual([undefined, "quien-soy", "pedi-tu-presupuesto"]);
    expect(tipos("eventos", "pedi_presupuesto")).toContain("INQUIRY_FORM");

    expect(tipos("estudio", "home")).toEqual(["HERO", "RICH_TEXT", "GALLERY", "CONTACT", "TESTIMONIALS"]);
    const contactoEstudio = getWebsiteTemplate("estudio")!.paginas[0].bloques.find((b) => b.type === "CONTACT");
    expect(contactoEstudio?.type === "CONTACT" && contactoEstudio.config.mapsUrl).toBeTruthy();
    expect(getWebsiteTemplate("estudio")!.paginas.map((p) => p.meta?.slug)).toEqual([undefined, "servicios", "visitanos"]);

    const editorial = getWebsiteTemplate("retrato-editorial")!;
    expect(editorial.design.typographyPreset).toBe("editorial");
    expect(editorial.paginas.map((p) => p.meta?.slug)).toEqual([undefined, "portfolio", "sobre-mi"]);

    const oscura = getWebsiteTemplate("oscura")!;
    const heroOscura = oscura.paginas[0].bloques[0];
    expect(heroOscura.type === "HERO" && heroOscura.config.slides[0].overlay).toBe("dark");
    const portfolioOscura = oscura.paginas[0].bloques.find((b) => b.type === "PORTFOLIO");
    expect(portfolioOscura?.type === "PORTFOLIO" && portfolioOscura.config.layout).toBe("masonry");
    expect(oscura.coloresSugeridos?.backgroundColor).toMatch(/^#[0-2]/);
    expect(oscura.paginas.map((p) => p.meta?.slug)).toEqual([undefined, "contacto"]);

    expect(tipos("institucion", "home")).toEqual(["HERO", "TEXT", "CTA", "BLOG_LATEST", "CONTACT"]);
  });
});

describe("getWebsiteTemplate", () => {
  it("devuelve undefined para un id inexistente, nunca inventa una plantilla", () => {
    expect(getWebsiteTemplate("no-existe")).toBeUndefined();
    expect(resolveTemplateId("no-existe")).toBeNull();
  });

  it("los ids viejos siguen resolviendo: un sitio guardado con «fotografica» abre en «eventos»", () => {
    expect(getWebsiteTemplate("fotografica")?.id).toBe("eventos");
    expect(getWebsiteTemplate("institucional")?.id).toBe("institucion");
    expect(getWebsiteTemplate("minimal")?.id).toBe("retrato-editorial");
    expect(resolveTemplateId("fotografica")).toBe("eventos");
    expect(resolveTemplateId("oscura")).toBe("oscura");
  });
});
