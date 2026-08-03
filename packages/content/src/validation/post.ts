import type { BlogPostStatus } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { CONTENT_POST_STATUS_VALUES, CONTENT_POST_TYPE_VALUES } from "../enums";
import { calculateReadingTimeFromContentJson } from "../reading-time";
import { parseContentSlug } from "../slug";
import {
  contentJsonHasH1,
  createEmptyContentJson,
  downgradeH1InContentJson,
} from "../tiptap/content-utils";
import { formatContentValidationError, optionalTrimmedString } from "./shared";

const contentPostStatusSchema = z.enum(CONTENT_POST_STATUS_VALUES);
const contentPostTypeSchema = z.enum(CONTENT_POST_TYPE_VALUES);

/** Campo TEXT libre (p. ej. seoGoal con JSON imagePlan). */
const optionalTrimmedText = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

const contentJsonSchema = z
  .object({
    type: z.literal("doc"),
  })
  .passthrough()
  .refine((value) => !contentJsonHasH1(value as JSONContent), {
    message:
      "El contenido no puede incluir encabezados H1. Usá H2–H6; el título del artículo es el H1 de la página.",
  });

const tagIdsSchema = z.array(z.coerce.number().int().positive()).optional().default([]);

const contentPostBaseFields = {
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z.string().trim().min(1).max(60).optional(),
  excerpt: optionalTrimmedString(500),
  contentJson: contentJsonSchema.optional(),
  heroImageUrl: optionalTrimmedString(2000),
  status: contentPostStatusSchema.optional(),
  type: contentPostTypeSchema.optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  lastReviewedAt: z.coerce.date().optional().nullable(),
  isFeatured: z.boolean().optional(),
  featuredUntil: z.coerce.date().optional().nullable(),
  seoTitle: optionalTrimmedString(200),
  seoDescription: optionalTrimmedString(320),
  seoGoal: optionalTrimmedText,
  ogImageUrl: optionalTrimmedString(2000),
  canonicalUrl: optionalTrimmedString(2000),
  noIndex: z.boolean().optional(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  authorId: z.coerce.number().int().positive().optional().nullable(),
  tagIds: tagIdsSchema,
};

function resolveSlug(title: string, slug?: string) {
  const slugSource = slug?.trim() || title;
  const slugResult = parseContentSlug(slugSource);
  if (!slugResult.ok) {
    throw new z.ZodError([
      {
        code: "custom",
        message: slugResult.error,
        path: ["slug"],
      },
    ]);
  }
  return slugResult.normalizedSlug;
}

export const contentPostCreateSchema = z
  .object(contentPostBaseFields)
  .transform((data) => ({
    ...data,
    slug: resolveSlug(data.title, data.slug),
    contentJson: (data.contentJson ?? createEmptyContentJson()) as JSONContent,
    status: data.status ?? "DRAFT",
    type: data.type ?? "BLOG",
    noIndex: data.noIndex ?? false,
    isFeatured: data.isFeatured ?? false,
    tagIds: data.tagIds ?? [],
  }));

export const contentPostUpdateSchema = z
  .object({
    ...contentPostBaseFields,
    title: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.slug !== undefined) {
      const slugResult = parseContentSlug(data.slug);
      if (!slugResult.ok) {
        ctx.addIssue({
          code: "custom",
          message: slugResult.error,
          path: ["slug"],
        });
      }
    }
    if (data.contentJson !== undefined && contentJsonHasH1(data.contentJson as JSONContent)) {
      ctx.addIssue({
        code: "custom",
        message:
          "El contenido no puede incluir encabezados H1. Usá H2–H6; el título del artículo es el H1 de la página.",
        path: ["contentJson"],
      });
    }
  })
  .transform((data) => {
    const next = { ...data };
    if (data.slug !== undefined) {
      const slugResult = parseContentSlug(data.slug);
      if (slugResult.ok) {
        next.slug = slugResult.normalizedSlug;
      }
    }
    return next;
  });

export type ContentPostCreateInput = z.infer<typeof contentPostCreateSchema>;
export type ContentPostUpdateInput = z.infer<typeof contentPostUpdateSchema>;

/** Alias CLF. */
export const blogPostCreateSchema = contentPostCreateSchema;
export const blogPostUpdateSchema = contentPostUpdateSchema;
export type BlogPostCreateInput = ContentPostCreateInput;
export type BlogPostUpdateInput = ContentPostUpdateInput;

export type PreparedContentPostContent = {
  contentJson: JSONContent;
  contentHtml: string;
  readingTimeMin: number;
};

export type PreparedBlogPostContent = PreparedContentPostContent;

/** Normaliza JSON, genera HTML sanitizado y tiempo de lectura (servidor al guardar). */
export async function prepareContentPostContent(
  contentJson: JSONContent
): Promise<PreparedContentPostContent> {
  const normalizedJson = downgradeH1InContentJson(contentJson);
  const { generateContentHtml } = await import("../tiptap/html");
  const contentHtml = await generateContentHtml(normalizedJson);
  const readingTimeMin = calculateReadingTimeFromContentJson(normalizedJson);
  return {
    contentJson: normalizedJson,
    contentHtml,
    readingTimeMin,
  };
}

export const prepareBlogPostContent = prepareContentPostContent;

/**
 * Ajusta publishedAt al publicar.
 * Si pasa a PUBLISHED sin fecha, usa now. Si vuelve a DRAFT, conserva publishedAt histórico.
 */
export function resolvePublishedAtForStatus(
  status: BlogPostStatus | ContentPostCreateInput["status"],
  publishedAt: Date | null | undefined,
  existingPublishedAt?: Date | null
): Date | null {
  if (status === "PUBLISHED") {
    return publishedAt ?? existingPublishedAt ?? new Date();
  }
  return publishedAt ?? existingPublishedAt ?? null;
}

export function parseContentPostCreate(body: unknown) {
  return contentPostCreateSchema.safeParse(body);
}

export function parseContentPostUpdate(body: unknown) {
  return contentPostUpdateSchema.safeParse(body);
}

export const parseBlogPostCreate = parseContentPostCreate;
export const parseBlogPostUpdate = parseContentPostUpdate;

export { formatContentValidationError, formatBlogValidationError } from "./shared";
export { createEmptyContentJson, createEmptyBlogContentJson } from "../tiptap/content-utils";
