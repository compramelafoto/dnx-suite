import { z } from "zod";

/**
 * Tipos de bloque alineados a Template V2 actual.
 * `container` no existe hoy en el editor — no se modela como soportado.
 */
export const TEMPLATE_BLOCK_TYPES = [
  "BACKGROUND",
  "PHOTO",
  "TEXT",
  "VARIABLE_TEXT",
  "IMAGE",
  "SHAPE",
] as const;

export type TemplateBlockType = (typeof TEMPLATE_BLOCK_TYPES)[number];

export const templateBlockLayoutSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().default(0),
  zIndex: z.number().finite().default(0),
  opacity: z.number().finite().min(0).max(1).default(1),
  locked: z.boolean().optional(),
  visible: z.boolean().default(true),
});

export type TemplateBlockLayout = z.infer<typeof templateBlockLayoutSchema>;

export const templateTypographySchema = z.object({
  fontFamily: z.string().default("Helvetica"),
  fontSize: z.number().finite().positive().default(20),
  fontWeight: z.number().finite().default(400),
  lineHeight: z.number().finite().positive().default(1.2),
  letterSpacing: z.number().finite().default(0),
  textAlign: z.enum(["LEFT", "CENTER", "RIGHT", "left", "center", "right"]).default("CENTER"),
  color: z.string().default("#111111"),
  fontItalic: z.boolean().default(false),
  underline: z.boolean().default(false),
});

export type TemplateTypography = z.infer<typeof templateTypographySchema>;

/** Tipografía + contenido estático (bloque TEXT). */
export const textBlockConfigSchema = templateTypographySchema.extend({
  content: z.string().default(""),
});

/** Tipografía + variable canónica (bloque VARIABLE_TEXT). */
export const variableTextBlockConfigSchema = templateTypographySchema.extend({
  variableKey: z.string().default(""),
  fallback: z.string().default(""),
});

export const imageBlockConfigSchema = z.object({
  src: z.string().default(""),
  fit: z.enum(["cover", "contain"]).default("cover"),
  borderRadius: z.number().finite().min(0).default(0),
  photoMode: z.enum(["single", "group", "free"]).default("free"),
  maskShape: z.enum(["rect", "circle", "ellipse"]).default("rect"),
  source: z
    .object({
      variableKey: z.string().optional(),
      src: z.string().optional(),
      url: z.string().optional(),
    })
    .passthrough()
    .default({}),
});

export const shapeBlockConfigSchema = z.object({
  variant: z.enum(["rectangle", "circle", "ellipse"]).default("rectangle"),
  fill: z.string().default("#e5e7eb"),
  stroke: z.string().default("#94a3b8"),
  strokeWidth: z.number().finite().min(0).default(0),
  radius: z.number().finite().min(0).default(0),
});

export const backgroundBlockConfigSchema = z.object({
  backgroundColor: z.string().default("#ffffff"),
  src: z.string().default(""),
  fit: z.enum(["cover", "contain"]).default("cover"),
});

/** PHOTO reutiliza config de IMAGE (hueco fotográfico V2). */
export const photoBlockConfigSchema = imageBlockConfigSchema;

/**
 * configJson se valida de forma laxa: objeto; la normalización tipada
 * ocurre por `type` en helpers. Se permite passthrough para no perder metadata.
 */
export const templateBlockConfigSchema = z.record(z.string(), z.unknown());

export const templateBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(TEMPLATE_BLOCK_TYPES),
  pageIndex: z.number().int().min(0).default(0),
  name: z.string().nullable().optional(),
  layout: templateBlockLayoutSchema,
  config: templateBlockConfigSchema.default({}),
});

export type TemplateBlock = z.infer<typeof templateBlockSchema>;

export const templateVariableBindingSchema = z.object({
  id: z.string().optional(),
  blockId: z.string().min(1),
  targetPath: z.string().min(1),
  variableKey: z.string().min(1),
  formatter: z.string().optional(),
  fallbackOverride: z.string().nullable().optional(),
});

export type TemplateVariableBinding = z.infer<typeof templateVariableBindingSchema>;
