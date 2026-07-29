import { z } from "zod";
import { findFiguresMissingAlt, findFiguresMissingCredit } from "@repo/editor";
import { ARTICLE_STATUSES } from "@/lib/article-status";
import {
  isGeographicScope,
  validateArticleLocationForPublish,
} from "@/lib/editorial/article-location";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalFloat = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

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
  coverCredit: optionalString,
  coverCaption: optionalString,
  seoTitle: optionalString,
  seoDescription: optionalString,
  /** Interno: siempre REAL en el flujo simplificado. */
  contentTag: z.enum(["DEMO", "REAL", "NEEDS_REVIEW"]).optional().default("REAL"),
  sourceName: optionalString,
  sourceUrl: optionalString,
  publishedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  status: z.enum(ARTICLE_STATUSES).default("DRAFT"),
  expectedUpdatedAt: optionalString,
  geographicScope: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && isGeographicScope(v) ? v : null)),
  countryCode: optionalString,
  countryName: optionalString,
  province: optionalString,
  city: optionalString,
  placeName: optionalString,
  address: optionalString,
  formattedAddress: optionalString,
  latitude: optionalFloat,
  longitude: optionalFloat,
});

export type ArticleDraftInput = z.infer<typeof articleDraftSchema>;

/** Checklist mínimo para salir a público (sin fact-check ni tag DEMO/REAL). */
export function validateForPublish(data: ArticleDraftInput): string[] {
  const errors: string[] = [];
  if (!data.content.trim()) errors.push("El contenido es obligatorio para publicar");
  if (!data.excerpt.trim()) errors.push("El extracto es obligatorio para publicar");
  if (!data.categoryId) errors.push("La categoría es obligatoria para publicar");
  if (data.title.includes("[PENDIENTE]") || data.title.includes("[Título editorial pendiente]")) {
    errors.push("Reemplazá el título provisional antes de publicar.");
  }
  if (data.content.includes("[COMPLETAR POR REDACCIÓN]")) {
    errors.push("Completá los placeholders del cuerpo antes de publicar.");
  }

  const missingCredit = findFiguresMissingCredit(data.content);
  if (missingCredit.length > 0) {
    errors.push(
      `Hay ${missingCredit.length} imagen(es) en el cuerpo sin crédito fotográfico.`,
    );
  }
  const missingAlt = findFiguresMissingAlt(data.content);
  if (missingAlt.length > 0) {
    errors.push(`Hay ${missingAlt.length} imagen(es) en el cuerpo sin texto alternativo.`);
  }

  errors.push(
    ...validateArticleLocationForPublish({
      geographicScope: data.geographicScope,
      countryCode: data.countryCode ?? null,
      countryName: data.countryName ?? null,
      province: data.province ?? null,
      city: data.city ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
    }),
  );

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
