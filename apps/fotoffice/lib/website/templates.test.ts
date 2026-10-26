import { describe, expect, it } from "vitest";
import { websiteBlockSchema, websitePageMetaSchema, type WebsiteBlockType } from "./blocks";
import { websiteDesignPresetsSchema } from "./design-presets";
import { HOME_PAGE_KEY, validatePageSlug } from "./pages";
import { siteMenuSchema } from "./site-menu";
import { MAX_CUSTOM_PAGES } from "./save-pages";
import { SITE_TEMPLATE_IDS, WEBSITE_TEMPLATES, fotosDeLaPlantilla, getWebsiteTemplate, resolveTemplateId } from "./templates";
import { enlaceDeBoton } from "./button-href";
import { anchorMapForBlocks } from "./navigation";
import type { WebsiteBlock } from "./blocks";
import { FOTOS_DE_MUESTRA } from "./templates/fotos";
import { isFotofficeOwnedR2Key } from "@/lib/images/r2-key-policy";

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

  it("los botones van a una sección de la misma página, a otra página de la plantilla o a ningún lado", () => {
    for (const template of WEBSITE_TEMPLATES) {
      const slugs = template.paginas.flatMap((p) => (p.meta ? [p.meta.slug] : []));
      const paginas = Object.fromEntries(slugs.map((s) => [s, `/w/x/${s}`]));
      for (const pagina of template.paginas) {
        const urls = pagina.bloques.flatMap((b) =>
          b.type === "CTA" ? [b.config.buttonUrl ?? ""] : b.type === "HERO" ? b.config.slides.map((s) => (s.showButton ? (s.buttonUrl ?? "") : "")) : [],
        );
        for (const url of urls.filter(Boolean)) {
          const href = enlaceDeBoton(url, paginas);
          expect(href === "#" || href?.startsWith("#") || href?.startsWith("/w/x/"), `${template.id}: ${url}`).toBe(true);
        }
      }
    }
  });

  it("cada botón `#ancla` apunta a una sección que existe en su misma página", () => {
    const urlsDe = (bloques: WebsiteBlock[]) =>
      bloques.flatMap((b) =>
        b.type === "CTA" ? [b.config.buttonUrl ?? ""] : b.type === "HERO" ? b.config.slides.map((s) => (s.showButton ? (s.buttonUrl ?? "") : "")) : [],
      );
    for (const template of WEBSITE_TEMPLATES) {
      for (const pagina of template.paginas) {
        const anclas = new Set(anchorMapForBlocks(pagina.bloques).values());
        for (const url of urlsDe(pagina.bloques).filter((u) => u.startsWith("#") && u.length > 1)) {
          expect(anclas.has(url.slice(1)), `${template.id}/${pagina.clave}: ${url}`).toBe(true);
        }
      }
    }
  });

  it("el color principal sugerido se lee con texto blanco encima (contraste WCAG ≥ 4,5:1)", () => {
    // Los botones del formulario, de testimonios y la franja del llamado a la acción llevan texto
    // blanco sobre el color principal: un principal claro los deja ilegibles.
    for (const template of WEBSITE_TEMPLATES) {
      if (!template.coloresSugeridos) continue; // Sin sugeridos (institución) se quedan los del dueño.
      expect(contraste(template.coloresSugeridos.primaryColor, "#ffffff"), template.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("cada plantilla tiene fotos de muestra para la vista previa", () => {
    for (const template of WEBSITE_TEMPLATES) expect(fotosDeLaPlantilla(template).length).toBeGreaterThanOrEqual(1);
  });

  it("cada foto de muestra tiene su clave R2 propia, bajo fotoffice/plantillas/ y fuera de lo borrable", () => {
    const claves = Object.values(FOTOS_DE_MUESTRA).map((f) => f.claveR2);
    expect(new Set(claves).size).toBe(claves.length);
    for (const clave of claves) {
      expect(clave).toMatch(/^fotoffice\/plantillas\/(eventos|estudio|retrato-editorial|oscura|institucion)\/\d+\.jpg$/);
      // Las comparten todos los sitios que aplicaron la plantilla: nada del sitio puede borrarlas.
      expect(isFotofficeOwnedR2Key(clave)).toBe(false);
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

/** Contraste WCAG 2 entre dos colores `#rrggbb`. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe("contraste", () => {
  it("calcula como WCAG", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});
