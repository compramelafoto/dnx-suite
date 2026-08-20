import { z } from "zod";

/**
 * Contrato de bloques estáticos de la Home del sitio web — primera etapa del editor visual.
 * Se persiste dentro de `sectionsJson` (ver `WebsiteSections` abajo). `type` ahora es una unión
 * cerrada de los 5 bloques implementados en esta etapa: cerrarla era trabajo pendiente desde la
 * etapa de arquitectura, y corresponde hacerlo ahora que se implementan de verdad. Bloques
 * dinámicos futuros (Cursos, Socios, Beneficios, Eventos, Noticias) se agregan como variantes
 * nuevas de esta unión cuando se construyan — nunca reutilizan estos 5 tipos.
 */
export const WEBSITE_BLOCK_ALIGN = ["left", "center"] as const;
export type WebsiteBlockAlign = (typeof WEBSITE_BLOCK_ALIGN)[number];

export const WEBSITE_IMAGE_WIDTH_PRESET = ["full", "contained", "narrow"] as const;
export type WebsiteImageWidthPreset = (typeof WEBSITE_IMAGE_WIDTH_PRESET)[number];

export const WEBSITE_CTA_STYLE_PRESET = ["solid", "outline"] as const;
export type WebsiteCtaStylePreset = (typeof WEBSITE_CTA_STYLE_PRESET)[number];

export const WEBSITE_SPACER_SIZE_PRESET = ["sm", "md", "lg"] as const;
export type WebsiteSpacerSizePreset = (typeof WEBSITE_SPACER_SIZE_PRESET)[number];

/** Id local (bloques y placas) — mismo criterio que `createEmptyBlock`: `crypto.randomUUID`
 * cuando existe, con fallback determinístico-suficiente para entornos sin Web Crypto. */
function generateLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Hero / Banner — placas del carrusel (Parte "Banner multiplaca"). Cada placa es una unidad
 * completa (imagen + texto + botón + presentación) independiente de las demás; 1 placa = Hero
 * estático de siempre, 2+ = carrusel. Nada de esto es `.min(1)` en los campos de texto por el
 * mismo motivo que el resto de bloques: un placa recién agregada, vacía, debe poder autoguardarse.
 */
export const HERO_SLIDE_ALIGN = ["left", "center", "right"] as const;
export type HeroSlideAlign = (typeof HERO_SLIDE_ALIGN)[number];

export const HERO_CONTENT_POSITION = ["top", "center", "bottom"] as const;
export type HeroContentPosition = (typeof HERO_CONTENT_POSITION)[number];

export const HERO_IMAGE_FOCUS = ["center", "top", "bottom", "left", "right"] as const;
export type HeroImageFocus = (typeof HERO_IMAGE_FOCUS)[number];

/** Presets simples de legibilidad — nunca opacity arbitraria (ver pedido: "no permitir controles
 * técnicos de opacity si podemos evitarlo"). `medium` reproduce exactamente el overlay fijo que
 * tenía el Hero de una sola placa antes de esta etapa (rgba(15,23,42,0.45)) — así una placa
 * migrada de un Hero viejo con imagen se ve pixel-a-pixel igual. */
export const HERO_OVERLAY_PRESET = ["none", "soft", "medium", "dark"] as const;
export type HeroOverlayPreset = (typeof HERO_OVERLAY_PRESET)[number];

export const HERO_TRANSITION = ["fade", "slide"] as const;
export type HeroTransition = (typeof HERO_TRANSITION)[number];

export const HERO_HEIGHT_PRESET = ["compact", "normal", "large", "screen"] as const;
export type HeroHeightPreset = (typeof HERO_HEIGHT_PRESET)[number];

export const HERO_INTERVAL_MS_OPTIONS = [3000, 5000, 7000, 10000] as const;
export type HeroIntervalMs = (typeof HERO_INTERVAL_MS_OPTIONS)[number];
const heroIntervalMsSchema = z.union([z.literal(3000), z.literal(5000), z.literal(7000), z.literal(10000)]);

export const HERO_MIN_SLIDES = 1;
export const HERO_MAX_SLIDES = 10;

export const heroSlideSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().max(2000).optional(),
  imageAlt: z.string().max(300).optional(),
  imageFocus: z.enum(HERO_IMAGE_FOCUS).catch("center"),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(400).optional(),
  showButton: z.boolean().catch(false),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  buttonStyle: z.enum(WEBSITE_CTA_STYLE_PRESET).catch("solid"),
  align: z.enum(HERO_SLIDE_ALIGN).catch("center"),
  contentPosition: z.enum(HERO_CONTENT_POSITION).catch("center"),
  overlay: z.enum(HERO_OVERLAY_PRESET).catch("none"),
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

export function createEmptyHeroSlide(): HeroSlide {
  return {
    id: generateLocalId(),
    imageFocus: "center",
    showButton: false,
    buttonStyle: "solid",
    align: "center",
    contentPosition: "center",
    overlay: "none",
  };
}

/** Shape plano del Hero de una sola placa, tal como se guardó hasta la etapa anterior — sigue
 * viviendo acá SOLO para migrar `sectionsJson`/`WebsiteVersion` histórico, nunca se escribe de
 * nuevo. */
const legacyHeroConfigSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(400).optional(),
  imageUrl: z.string().max(2000).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

/**
 * Migra un Hero guardado en el shape plano anterior (sin `slides`) a una única placa del
 * carrusel — preserva exactamente título/subtítulo/imagen/botón/alineación, cero pérdida de
 * contenido. Corre en el `preprocess` del schema, así que nunca se persiste sola: el draft se
 * normaliza recién si el usuario vuelve a guardar. Un objeto que YA tiene `slides` (Hero nuevo)
 * pasa sin tocar.
 */
function normalizeHeroConfig(raw: unknown): unknown {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw) && !("slides" in raw)) {
    const legacy = legacyHeroConfigSchema.safeParse(raw);
    if (legacy.success) {
      const { title, subtitle, imageUrl, buttonLabel, buttonUrl, align } = legacy.data;
      return {
        slides: [
          {
            id: "legacy",
            imageUrl,
            imageFocus: "center",
            title,
            subtitle,
            showButton: Boolean(buttonLabel && buttonUrl),
            buttonLabel,
            buttonUrl,
            buttonStyle: "solid",
            align,
            contentPosition: "center",
            overlay: imageUrl ? "medium" : "none",
          },
        ],
        autoplay: true,
        intervalMs: 5000,
        transition: "fade",
        showArrows: true,
        showIndicators: true,
        pauseOnHover: true,
        loop: true,
        heightPreset: "large",
      };
    }
  }
  return raw;
}

export const heroConfigSchema = z.preprocess(
  normalizeHeroConfig,
  z.object({
    slides: z.array(heroSlideSchema).min(HERO_MIN_SLIDES).max(HERO_MAX_SLIDES),
    autoplay: z.boolean().catch(true),
    intervalMs: heroIntervalMsSchema.catch(5000),
    transition: z.enum(HERO_TRANSITION).catch("fade"),
    showArrows: z.boolean().catch(true),
    showIndicators: z.boolean().catch(true),
    pauseOnHover: z.boolean().catch(true),
    loop: z.boolean().catch(true),
    heightPreset: z.enum(HERO_HEIGHT_PRESET).catch("large"),
  }),
);

/** Helpers puros de edición de placas — los usa el inspector del Hero; viven acá (no en el
 * componente) para poder testearlos sin renderizar React. Ninguno muta el config recibido. */
export function addHeroSlide(config: HeroBlockConfig): HeroBlockConfig {
  if (config.slides.length >= HERO_MAX_SLIDES) return config;
  return { ...config, slides: [...config.slides, createEmptyHeroSlide()] };
}

export function duplicateHeroSlide(config: HeroBlockConfig, slideId: string): HeroBlockConfig {
  const index = config.slides.findIndex((s) => s.id === slideId);
  if (index === -1 || config.slides.length >= HERO_MAX_SLIDES) return config;
  const clone: HeroSlide = { ...config.slides[index], id: generateLocalId() };
  return { ...config, slides: [...config.slides.slice(0, index + 1), clone, ...config.slides.slice(index + 1)] };
}

export function removeHeroSlide(config: HeroBlockConfig, slideId: string): HeroBlockConfig {
  if (config.slides.length <= HERO_MIN_SLIDES) return config;
  return { ...config, slides: config.slides.filter((s) => s.id !== slideId) };
}

export function moveHeroSlide(config: HeroBlockConfig, slideId: string, direction: "up" | "down"): HeroBlockConfig {
  const index = config.slides.findIndex((s) => s.id === slideId);
  if (index === -1) return config;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= config.slides.length) return config;
  const slides = [...config.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...config, slides };
}

export function updateHeroSlide(config: HeroBlockConfig, slideId: string, patch: Partial<HeroSlide>): HeroBlockConfig {
  return { ...config, slides: config.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)) };
}

export const textConfigSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(8000).optional(),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

export const imageConfigSchema = z.object({
  imageUrl: z.string().max(2000).optional(),
  alt: z.string().max(300).optional(),
  caption: z.string().max(300).optional(),
  widthPreset: z.enum(WEBSITE_IMAGE_WIDTH_PRESET),
});

export const ctaConfigSchema = z.object({
  title: z.string().max(200).optional(),
  text: z.string().max(400).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  stylePreset: z.enum(WEBSITE_CTA_STYLE_PRESET),
});

export const spacerConfigSchema = z.object({
  sizePreset: z.enum(WEBSITE_SPACER_SIZE_PRESET),
});

const blockEnvelope = {
  id: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0),
};

export const heroBlockSchema = z.object({ ...blockEnvelope, type: z.literal("HERO"), config: heroConfigSchema });
export const textBlockSchema = z.object({ ...blockEnvelope, type: z.literal("TEXT"), config: textConfigSchema });
export const imageBlockSchema = z.object({ ...blockEnvelope, type: z.literal("IMAGE"), config: imageConfigSchema });
export const ctaBlockSchema = z.object({ ...blockEnvelope, type: z.literal("CTA"), config: ctaConfigSchema });
export const spacerBlockSchema = z.object({ ...blockEnvelope, type: z.literal("SPACER"), config: spacerConfigSchema });

export const websiteBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  ctaBlockSchema,
  spacerBlockSchema,
]);

export const websitePageContentSchema = z.array(websiteBlockSchema);

/** Forma completa de `sectionsJson`. Ya envuelto en `pages` aunque hoy solo exista `"home"`. */
export const websiteSectionsSchema = z.object({
  pages: z.record(z.string(), websitePageContentSchema),
});

export type HeroBlockConfig = z.infer<typeof heroConfigSchema>;
export type TextBlockConfig = z.infer<typeof textConfigSchema>;
export type ImageBlockConfig = z.infer<typeof imageConfigSchema>;
export type CtaBlockConfig = z.infer<typeof ctaConfigSchema>;
export type SpacerBlockConfig = z.infer<typeof spacerConfigSchema>;

export type HeroBlock = z.infer<typeof heroBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type SpacerBlock = z.infer<typeof spacerBlockSchema>;

/** Unión cerrada de los bloques implementados. Bloques con `type` desconocido no matchean acá
 * — el renderer y el editor deben tratarlos como inválidos y omitirlos, nunca romper la página. */
export type WebsiteBlock = z.infer<typeof websiteBlockSchema>;

export type WebsiteBlockType = WebsiteBlock["type"];

/** Bloques de una página pública, en orden. */
export type WebsitePageContent = WebsiteBlock[];

export type WebsiteSections = z.infer<typeof websiteSectionsSchema>;

export function emptyWebsiteSections(): WebsiteSections {
  return { pages: { home: [] } };
}

/**
 * Parseo tolerante de `sectionsJson` tal como viene de la DB (`Json | null`, sin garantía de
 * forma). Un bloque individual inválido no debe tumbar la carga de toda la página, así que se
 * descarta bloque por bloque en vez de fallar la página completa cuando algún bloque no matchea
 * el schema — el resto de bloques válidos se conserva.
 */
export function parseWebsiteSections(raw: unknown): WebsiteSections {
  if (raw === null || typeof raw !== "object") return emptyWebsiteSections();
  const pagesRaw = (raw as { pages?: unknown }).pages;
  if (pagesRaw === null || typeof pagesRaw !== "object") return emptyWebsiteSections();

  const pages: Record<string, WebsiteBlock[]> = {};
  for (const [pageKey, blocksRaw] of Object.entries(pagesRaw as Record<string, unknown>)) {
    if (!Array.isArray(blocksRaw)) continue;
    const validBlocks: WebsiteBlock[] = [];
    for (const blockRaw of blocksRaw) {
      const parsed = websiteBlockSchema.safeParse(blockRaw);
      if (parsed.success) validBlocks.push(parsed.data);
    }
    pages[pageKey] = validBlocks;
  }
  if (!pages.home) pages.home = [];
  return { pages };
}

/**
 * Categorías del catálogo de secciones. Solo BASICAS tiene bloques implementados hoy — el
 * resto queda declarado para que el selector de secciones ya tenga la forma final (categorías
 * agrupadas) sin tener que rediseñarlo cuando se implemente el primer bloque de cada una.
 * INSTITUCION/SOCIOS/ACTIVIDAD/COMUNICACION/COMERCIAL serán bloques `source: "dynamic"`
 * (resuelven datos de otro módulo vía DTO público, ver `block-contract.ts`) — ninguno
 * implementado todavía, a propósito.
 */
export const WEBSITE_BLOCK_CATEGORIES = ["BASICAS", "INSTITUCION", "SOCIOS", "ACTIVIDAD", "COMUNICACION", "COMERCIAL"] as const;
export type WebsiteBlockCategory = (typeof WEBSITE_BLOCK_CATEGORIES)[number];

type BlockTypeDefinition<TType extends WebsiteBlockType> = {
  type: TType;
  label: string;
  description: string;
  category: WebsiteBlockCategory;
  /** `dynamic` = resuelve datos de otro módulo en el momento del render (ninguno implementado
   * todavía). Los 5 bloques de esta etapa son `static`: su contenido vive en `config`. */
  source: "static" | "dynamic";
  defaultConfig: () => Extract<WebsiteBlock, { type: TType }>["config"];
  previewLabel: (config: Extract<WebsiteBlock, { type: TType }>["config"]) => string;
};

/** Registro único de metadata por tipo de bloque — lo consumen el selector "Agregar sección",
 * el listado de tarjetas y el renderer. Agregar un bloque nuevo se hace acá, en un solo lugar
 * (más `block-registry.tsx` para su View/Inspector visual). */
export const WEBSITE_BLOCK_DEFINITIONS: {
  [K in WebsiteBlockType]: BlockTypeDefinition<K>;
} = {
  HERO: {
    type: "HERO",
    label: "Hero / Banner",
    description: "Portada principal — una placa o un carrusel de varias.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({
      slides: [createEmptyHeroSlide()],
      autoplay: true,
      intervalMs: 5000,
      transition: "fade",
      showArrows: true,
      showIndicators: true,
      pauseOnHover: true,
      loop: true,
      heightPreset: "large",
    }),
    // Ojo: este mismo label alimenta el menú de navegación público (`deriveHomeNavItems` en
    // navigation.ts) además del listado de "Secciones" del builder — nunca le agregues acá texto
    // de administración (ej. "· N placas"), terminaría como texto de un item real del menú.
    previewLabel: (c) => c.slides[0]?.title || "Sin título todavía",
  },
  TEXT: {
    type: "TEXT",
    label: "Texto",
    description: "Bloque de contenido.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", content: "", align: "left" }),
    previewLabel: (c) => c.title || (c.content ?? "").slice(0, 60) || "Sin contenido todavía",
  },
  IMAGE: {
    type: "IMAGE",
    label: "Imagen",
    description: "Imagen destacada.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ imageUrl: "", alt: "", caption: "", widthPreset: "full" }),
    previewLabel: (c) => c.caption || c.alt || "Sin imagen todavía",
  },
  CTA: {
    type: "CTA",
    label: "Llamado a la acción",
    description: "Título, descripción y botón.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", text: "", buttonLabel: "", buttonUrl: "", stylePreset: "solid" }),
    previewLabel: (c) => c.title || "Sin título todavía",
  },
  SPACER: {
    type: "SPACER",
    label: "Separador",
    description: "Espacio visual entre secciones.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ sizePreset: "md" }),
    previewLabel: (c) => `Tamaño: ${c.sizePreset === "sm" ? "chico" : c.sizePreset === "lg" ? "grande" : "medio"}`,
  },
};

export const WEBSITE_BLOCK_TYPES = Object.keys(WEBSITE_BLOCK_DEFINITIONS) as WebsiteBlockType[];

export function createEmptyBlock(type: WebsiteBlockType, order: number): WebsiteBlock {
  const def = WEBSITE_BLOCK_DEFINITIONS[type];
  return { id: generateLocalId(), type, visible: true, order, config: def.defaultConfig() } as WebsiteBlock;
}

export function getBlockPreviewLabel(block: WebsiteBlock): string {
  const def = WEBSITE_BLOCK_DEFINITIONS[block.type] as BlockTypeDefinition<typeof block.type>;
  return def.previewLabel(block.config as never);
}
