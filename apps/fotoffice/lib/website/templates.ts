import { addHeroSlide, createEmptyBlock, updateHeroSlide, type HeroBlock, type HeroSlide, type WebsiteBlock } from "./blocks";
import { DEFAULT_DESIGN_PRESETS, type WebsiteDesignPresets } from "./design-presets";
import type { FotofficeOrganizationTypeId } from "../onboarding-constants";

/**
 * Plantillas: un punto de partida, NO un dueño del contenido. Aplicar una plantilla en un sitio
 * VACÍO siembra secciones + preset de diseño de una sola vez (`seedSections` + `designPreset`).
 * En un sitio que YA tiene contenido, cambiar de plantilla solo debe tocar `designPreset` —
 * nunca reemplazar `sectionsJson.pages.home` — para no destruir texto/imágenes ya cargados (ver
 * `applyTemplateDesignOnly` en el builder). El campo `tier` está reservado para una futura
 * distinción gratis/premium — sin lógica de billing todavía, solo el campo.
 *
 * `recommendedFor` usa los tipos de organización REALES de FotoOffice (`onboarding-constants`) —
 * es una recomendación, nunca una restricción: toda plantilla queda disponible para cualquier
 * workspace, esto solo decide qué se muestra primero/destacado.
 *
 * `layoutPreview` describe la miniatura de la tarjeta de forma abstracta (qué franjas dibujar,
 * no una imagen generada) — evita depender de assets gráficos que no existen todavía.
 */
export type LayoutPreviewBand = "hero" | "text" | "image" | "cta";

export type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  recommendedFor: FotofficeOrganizationTypeId[];
  tier: "free";
  layoutPreview: LayoutPreviewBand[];
  designPreset: WebsiteDesignPresets;
  seedSections: () => WebsiteBlock[];
};

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "institucional",
    name: "Institucional",
    description: "Para clubes, cámaras y asociaciones — sobria, con foco en información.",
    recommendedFor: ["PHOTOGRAPHERS_ASSOCIATION", "CULTURAL_ORGANIZATION", "NONPROFIT", "EDUCATIONAL_INSTITUTION"],
    tier: "free",
    layoutPreview: ["hero", "text", "cta"],
    designPreset: { ...DEFAULT_DESIGN_PRESETS, headerPreset: "logo-left", buttonPreset: "square", typographyPreset: "institutional", animationPreset: "none" },
    seedSections: () => [
      withHeroSlide(createEmptyBlock("HERO", 0), { title: "Bienvenidos", subtitle: "Contanos quiénes somos.", align: "center" }),
      withOverrides(createEmptyBlock("TEXT", 1), { title: "Sobre nosotros", content: "Contá acá la historia de tu organización." }),
      withOverrides(createEmptyBlock("CTA", 2), { title: "¿Querés sumarte?", buttonLabel: "Contactanos", buttonUrl: "#contacto" }),
    ],
  },
  {
    id: "fotografica",
    name: "Fotográfica",
    description: "Foco visual — un Hero con imagen grande y una imagen destacada abajo.",
    recommendedFor: ["PHOTO_STUDIO", "FREELANCE_PHOTOGRAPHER", "PHOTOGRAPHY_COMPANY", "AGENCY_PRODUCTION"],
    tier: "free",
    layoutPreview: ["hero", "image", "cta"],
    designPreset: { ...DEFAULT_DESIGN_PRESETS, headerPreset: "transparent-hero", buttonPreset: "pill", typographyPreset: "photographic", animationPreset: "soft" },
    seedSections: () => [
      withHeroSlides(createEmptyBlock("HERO", 0), [
        { title: "Tu fotografía, en primer plano", align: "center", overlay: "medium" },
        { title: "Cada sesión, una historia distinta", align: "center", overlay: "medium" },
      ]),
      withOverrides(createEmptyBlock("IMAGE", 1), { alt: "Foto destacada", widthPreset: "full" }),
      withOverrides(createEmptyBlock("CTA", 2), { title: "Ver más trabajo", buttonLabel: "Contactanos", buttonUrl: "#contacto" }),
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Lo esencial: título, un párrafo y un llamado a la acción.",
    recommendedFor: ["FREELANCE_PHOTOGRAPHER", "PHOTOGRAPHY_COMMUNITY", "OTHER"],
    tier: "free",
    layoutPreview: ["hero", "text"],
    designPreset: DEFAULT_DESIGN_PRESETS,
    seedSections: () => [
      withHeroSlide(createEmptyBlock("HERO", 0), { title: "Título de tu sitio", align: "left" }),
      withOverrides(createEmptyBlock("TEXT", 1), { content: "Un párrafo breve que explica qué hacés." }),
    ],
  },
];

function withOverrides<T extends WebsiteBlock>(block: T, overrides: Partial<T["config"]>): T {
  return { ...block, config: { ...block.config, ...overrides } };
}

/** Aplica overrides a la (única) placa que ya trae un Hero recién creado — mismo criterio que
 * `withOverrides` para los demás bloques, pero el Hero guarda su contenido dentro de `slides`. */
function withHeroSlide(block: WebsiteBlock, overrides: Partial<HeroSlide>): WebsiteBlock {
  const hero = block as HeroBlock;
  return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, overrides) };
}

/** Igual que `withHeroSlide`, pero siembra tantas placas como overrides se pasen — cada entrada
 * de `overridesList` configura una placa nueva del carrusel, en orden. */
function withHeroSlides(block: WebsiteBlock, overridesList: Partial<HeroSlide>[]): WebsiteBlock {
  const hero = block as HeroBlock;
  let config = hero.config;
  while (config.slides.length < overridesList.length) config = addHeroSlide(config);
  overridesList.forEach((overrides, i) => {
    config = updateHeroSlide(config, config.slides[i].id, overrides);
  });
  return { ...hero, config };
}

export function getWebsiteTemplate(id: string): WebsiteTemplate | undefined {
  return WEBSITE_TEMPLATES.find((t) => t.id === id);
}
