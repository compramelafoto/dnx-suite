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

export const heroConfigSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(200),
  subtitle: z.string().max(400).optional(),
  imageUrl: z.string().max(2000).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

export const textConfigSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, "El contenido es obligatorio").max(8000),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

export const imageConfigSchema = z.object({
  imageUrl: z.string().min(1, "La imagen es obligatoria").max(2000),
  alt: z.string().min(1, "El texto alternativo es obligatorio").max(300),
  caption: z.string().max(300).optional(),
  widthPreset: z.enum(WEBSITE_IMAGE_WIDTH_PRESET),
});

export const ctaConfigSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(200),
  text: z.string().max(400).optional(),
  buttonLabel: z.string().min(1, "El texto del botón es obligatorio").max(60),
  buttonUrl: z.string().min(1, "La URL del botón es obligatoria").max(2000),
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

type BlockTypeDefinition<TType extends WebsiteBlockType> = {
  type: TType;
  label: string;
  description: string;
  group: "CONTENIDO";
  defaultConfig: () => Extract<WebsiteBlock, { type: TType }>["config"];
  previewLabel: (config: Extract<WebsiteBlock, { type: TType }>["config"]) => string;
};

/** Registro único de metadata por tipo de bloque — lo consumen el selector "Agregar sección",
 * el listado de tarjetas y el renderer. Agregar un bloque nuevo se hace acá, en un solo lugar. */
export const WEBSITE_BLOCK_DEFINITIONS: {
  [K in WebsiteBlockType]: BlockTypeDefinition<K>;
} = {
  HERO: {
    type: "HERO",
    label: "Hero",
    description: "Portada principal con título, imagen y botón.",
    group: "CONTENIDO",
    defaultConfig: () => ({ title: "", subtitle: "", buttonLabel: "", buttonUrl: "", align: "center" }),
    previewLabel: (c) => c.title || "Sin título todavía",
  },
  TEXT: {
    type: "TEXT",
    label: "Texto",
    description: "Bloque de contenido.",
    group: "CONTENIDO",
    defaultConfig: () => ({ title: "", content: "", align: "left" }),
    previewLabel: (c) => c.title || c.content.slice(0, 60) || "Sin contenido todavía",
  },
  IMAGE: {
    type: "IMAGE",
    label: "Imagen",
    description: "Imagen destacada.",
    group: "CONTENIDO",
    defaultConfig: () => ({ imageUrl: "", alt: "", caption: "", widthPreset: "full" }),
    previewLabel: (c) => c.caption || c.alt || "Sin imagen todavía",
  },
  CTA: {
    type: "CTA",
    label: "Llamado a la acción",
    description: "Título, descripción y botón.",
    group: "CONTENIDO",
    defaultConfig: () => ({ title: "", text: "", buttonLabel: "", buttonUrl: "", stylePreset: "solid" }),
    previewLabel: (c) => c.title || "Sin título todavía",
  },
  SPACER: {
    type: "SPACER",
    label: "Separador",
    description: "Espacio visual entre secciones.",
    group: "CONTENIDO",
    defaultConfig: () => ({ sizePreset: "md" }),
    previewLabel: (c) => `Tamaño: ${c.sizePreset === "sm" ? "chico" : c.sizePreset === "lg" ? "grande" : "medio"}`,
  },
};

export const WEBSITE_BLOCK_TYPES = Object.keys(WEBSITE_BLOCK_DEFINITIONS) as WebsiteBlockType[];

export function createEmptyBlock(type: WebsiteBlockType, order: number): WebsiteBlock {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const def = WEBSITE_BLOCK_DEFINITIONS[type];
  return { id, type, visible: true, order, config: def.defaultConfig() } as WebsiteBlock;
}

export function getBlockPreviewLabel(block: WebsiteBlock): string {
  const def = WEBSITE_BLOCK_DEFINITIONS[block.type] as BlockTypeDefinition<typeof block.type>;
  return def.previewLabel(block.config as never);
}
