import { z } from "zod";
import { ARTICLE_STATUSES } from "@/lib/article-status";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const articleDraftSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (solo minúsculas, números y guiones)"),
  excerpt: z.string().trim().max(500).optional().default(""),
  content: z.string().max(200_000).optional().default(""),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  coverImageId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  seoTitle: optionalString,
  seoDescription: optionalString,
  contentTag: z
    .enum(["DEMO", "REAL", "NEEDS_REVIEW"])
    .optional()
    .default("NEEDS_REVIEW"),
  sourceName: optionalString,
  sourceUrl: optionalString,
  publishedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.enum(ARTICLE_STATUSES).default("DRAFT"),
  markFactChecked: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1"),
});

export type ArticleDraftInput = z.infer<typeof articleDraftSchema>;

export function validateForPublish(data: ArticleDraftInput): string[] {
  const errors: string[] = [];
  if (!data.content.trim()) errors.push("El contenido es obligatorio para publicar");
  if (!data.excerpt.trim()) errors.push("El extracto es obligatorio para publicar");
  if (!data.categoryId) errors.push("La categoría es obligatoria para publicar");
  if (data.contentTag !== "REAL") {
    errors.push(
      "Para publicar en el sitio público la etiqueta debe ser REAL (no DEMO ni NEEDS_REVIEW).",
    );
  }
  if (!data.sourceName?.trim()) {
    errors.push("Indicá la fuente verificada (sourceName) antes de publicar.");
  }
  if (data.title.includes("[PENDIENTE]") || data.title.includes("[Título editorial pendiente]")) {
    errors.push("Reemplazá el título provisional antes de publicar.");
  }
  if (data.content.includes("[COMPLETAR POR REDACCIÓN]")) {
    errors.push("Completá los placeholders del cuerpo antes de publicar.");
  }
  if (!data.markFactChecked) {
    errors.push("Confirmá la revisión factual (fact-check) antes de publicar.");
  }
  if (!data.seoTitle?.trim()) errors.push("Completá el SEO title antes de publicar.");
  if (!data.seoDescription?.trim()) {
    errors.push("Completá la SEO description antes de publicar.");
  }
  return errors;
}

export function formatFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
