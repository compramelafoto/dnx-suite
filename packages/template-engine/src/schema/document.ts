import { z } from "zod";
import { TEMPLATE_SCHEMA_VERSION } from "../core/constants";
import {
  templateBlockSchema,
  templateVariableBindingSchema,
} from "./blocks";

export const templateBackgroundSchema = z.object({
  color: z.string().optional(),
  src: z.string().optional(),
  fit: z.enum(["cover", "contain"]).optional(),
});

export type TemplateBackground = z.infer<typeof templateBackgroundSchema>;

/**
 * Metadatos de impresión ya presentes en Template V2 (canvas.dpi / bleed / safeArea).
 * No se inventan unidades distintas de px para el lienzo.
 */
export const templatePrintMetaSchema = z.object({
  dpi: z.number().finite().positive().optional(),
  bleedMm: z.number().finite().min(0).optional(),
  safeAreaMm: z.number().finite().min(0).optional(),
});

export type TemplatePrintMeta = z.infer<typeof templatePrintMetaSchema>;

/**
 * Documento canónico versionado.
 * `unit` es siempre `"px"` (coordenadas del editor DOM actual).
 */
export const templateDocumentSchema = z.object({
  schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
  id: z.string().optional(),
  name: z.string().min(1),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  unit: z.literal("px"),
  background: templateBackgroundSchema.optional(),
  print: templatePrintMetaSchema.optional(),
  blocks: z.array(templateBlockSchema).default([]),
  bindings: z.array(templateVariableBindingSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TemplateDocument = z.infer<typeof templateDocumentSchema>;

/** Documento tras resolución de variables (mismos bloques; configs con valores resueltos). */
export type ResolvedTemplateDocument = TemplateDocument & {
  resolvedAt?: string;
};
