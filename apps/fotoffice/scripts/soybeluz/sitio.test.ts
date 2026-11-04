import { describe, expect, it } from "vitest";
import { parseWebsiteSections, websiteSectionsSchema, type WebsiteBlock } from "@/lib/website/blocks";
import { parseWebsiteDesignPresets, resolvedTypography } from "@/lib/website/design-presets";
import { isSiteSegmentReserved } from "@/lib/website/public-modules";
import { siteMenuSchema } from "@/lib/website/site-menu";
import { SOYBELUZ_COLORES, SOYBELUZ_DISENO, SOYBELUZ_MENU, SOYBELUZ_SECCIONES } from "./sitio";

/** La paleta del manual de marca V1.1 (página 06). */
const PALETA = { cacao: "#60433A", rosaViejo: "#C99A9D", arena: "#E5D4C2", terracota: "#B87A60", marfil: "#FAF6EF" };

/** Razón de contraste WCAG 2.x entre dos colores hex. */
function contraste(a: string, b: string): number {
  const luz = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Todo el texto que ve el visitante, de cualquier bloque (recorre la config entera). */
function textoVisible(bloques: WebsiteBlock[]): string {
  const partes: string[] = [];
  const recorrer = (v: unknown, clave = "") => {
    if (typeof v === "string" && !/url|id|phone|icon|align|preset|style|type|focus|position|overlay|transition/i.test(clave)) partes.push(v);
    else if (Array.isArray(v)) v.forEach((x) => recorrer(x, clave));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) recorrer(x, k);
  };
  bloques.forEach((b) => recorrer(b.config));
  return partes.join("\n");
}

const todasLasPaginas = () => Object.values(SOYBELUZ_SECCIONES.pages).flat();

describe("sitio de SOYBELUZ", () => {
  it("pasa el esquema estricto del constructor y no se pierde nada al leerlo", () => {
    expect(() => websiteSectionsSchema.parse(SOYBELUZ_SECCIONES)).not.toThrow();
    expect(parseWebsiteSections(SOYBELUZ_SECCIONES)).toEqual(SOYBELUZ_SECCIONES);
    expect(() => siteMenuSchema.parse(SOYBELUZ_MENU)).not.toThrow();
  });

  it("el menú visible sigue el orden del brief (Mi cuenta es el botón del encabezado)", () => {
    const etiquetas = SOYBELUZ_MENU.items.filter((i) => !i.hidden).map((i) => i.label);
    expect(etiquetas).toEqual([
      "Inicio",
      "Clases creativas gratuitas",
      "Espacio creativo",
      "Cursos",
      "Materiales",
      "Encuentros en vivo",
      "Comunidad",
      "Sobre SOYBELUZ",
      "Suscripción",
    ]);
    expect(SOYBELUZ_DISENO.loginButtonLabel).toBe("Mi cuenta");
  });

  it("la página automática de asociarse queda oculta hasta la Etapa 2", () => {
    const asociarse = SOYBELUZ_MENU.items.find((i) => i.kind === "page" && i.page === "members");
    expect(asociarse?.hidden).toBe(true);
  });

  it("cada entrada propia del menú apunta a una página con su meta, y ningún slug choca con una dirección reservada", () => {
    for (const item of SOYBELUZ_MENU.items) {
      if (item.kind !== "custom") continue;
      expect(SOYBELUZ_SECCIONES.pages[item.pageKey]).toBeDefined();
      expect(SOYBELUZ_SECCIONES.pageMeta[item.pageKey]).toBeDefined();
    }
    for (const meta of Object.values(SOYBELUZ_SECCIONES.pageMeta)) expect(isSiteSegmentReserved(meta.slug)).toBe(false);
  });

  it("usa sólo colores de la paleta, con cacao sobre marfil para leer", () => {
    for (const hex of Object.values(SOYBELUZ_COLORES)) expect(Object.values(PALETA)).toContain(hex.toUpperCase());
    expect(SOYBELUZ_COLORES.textColor).toBe(PALETA.cacao);
    expect(SOYBELUZ_COLORES.backgroundColor).toBe(PALETA.marfil);
  });

  it("los pares de color que lleva texto tienen contraste suficiente (nunca rosa sobre arena)", () => {
    expect(contraste(SOYBELUZ_COLORES.textColor, SOYBELUZ_COLORES.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(SOYBELUZ_COLORES.textColor, SOYBELUZ_COLORES.panelColor)).toBeGreaterThanOrEqual(4.5);
    // Los botones llevan texto claro sobre el acento y sobre el principal.
    expect(contraste(PALETA.marfil, SOYBELUZ_COLORES.primaryColor)).toBeGreaterThanOrEqual(4.5);
    expect(SOYBELUZ_COLORES.textColor).not.toBe(PALETA.rosaViejo);
    expect(SOYBELUZ_COLORES.textColor).not.toBe(PALETA.arena);
  });

  it("los pares que el sitio dibuja con texto blanco tienen contraste suficiente", () => {
    // Hero sin foto: texto blanco sobre el secundario. Botones sólidos y «Mi cuenta»: blanco sobre
    // el acento. CTA: blanco sobre el principal. (hero-block-view, website-header-view)
    for (const fondo of [SOYBELUZ_COLORES.secondaryColor, SOYBELUZ_COLORES.accentColor, SOYBELUZ_COLORES.primaryColor]) {
      expect(contraste("#FFFFFF", fondo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el botón de la portada no es sólido: fondo y botón serían cacao sobre cacao", () => {
    const portada = SOYBELUZ_SECCIONES.pages.home.find((b) => b.type === "HERO");
    const placas = portada?.type === "HERO" ? portada.config.slides : [];
    expect(SOYBELUZ_COLORES.secondaryColor).toBe(SOYBELUZ_COLORES.accentColor);
    for (const placa of placas) if (placa.showButton) expect(placa.buttonStyle).toBe("outline");
  });

  it("el menú de nueve entradas va en panel lateral: en barra superior no entra", () => {
    expect(SOYBELUZ_DISENO.menuLayout).toBe("drawer");
  });

  it("el grupo gratuito de WhatsApp se ve aunque falte el enlace (no depende de un teléfono)", () => {
    const bloques = SOYBELUZ_SECCIONES.pages.clases_gratuitas;
    expect(bloques.some((b) => b.type === "WHATSAPP_BUTTON")).toBe(false);
    expect(textoVisible(bloques)).toContain("Grupo gratuito de WhatsApp");
  });

  it("respeta la voz del manual", () => {
    const texto = textoVisible(todasLasPaginas()).toLowerCase();
    for (const prohibida of ["juntas", "socio", "socia", "alumna", "alumno"]) expect(texto).not.toContain(prohibida);
    expect(texto).toContain("vení a crear con beluz");
  });

  it("cada propuesta concreta dice edad, nivel, modalidad, materiales y duración", () => {
    for (const clave of ["clases_gratuitas", "encuentros"]) {
      const texto = textoVisible(SOYBELUZ_SECCIONES.pages[clave]);
      for (const dato of ["Edad sugerida", "Nivel", "Modalidad", "Materiales", "Duración", "Apoyos"]) expect(texto).toContain(dato);
    }
  });

  it("todo el sitio va en DejaVu Sans, títulos en negrita y texto de 16 px o más", () => {
    const leido = parseWebsiteDesignPresets(SOYBELUZ_DISENO);
    const t = resolvedTypography(leido);
    expect(Object.values(t).every((nivel) => nivel.font === "dejavu-sans")).toBe(true);
    expect(t.title.weight).toBe(700);
    expect(t.heading.weight).toBe(700);
    expect(t.body.weight).toBe(400);
    // Tamaños del cuerpo: sm = 15 px, md = 16 px (`typography.ts`).
    expect(t.body.size).not.toBe("sm");
  });

  it("el logo queda en el mínimo del manual (200 px de ancho para un conjunto de 1,82:1)", () => {
    expect(SOYBELUZ_DISENO.logoSizePx * 1.82).toBeGreaterThanOrEqual(200);
  });
});
