import type { BlogPostStatus } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import {
  BLOG_POST_STATUS_VALUES,
  BLOG_POST_TYPE_VALUES,
} from "@/lib/blog/blog-enums";
import { calculateReadingTimeFromContentJson } from "@/lib/blog/reading-time";
import { parseBlogSlug } from "@/lib/blog/slugify-blog";
import {
  contentJsonHasH1,
  createEmptyBlogContentJson,
  downgradeH1InContentJson,
} from "@/lib/blog/tiptap-content-utils";
import { formatBlogValidationError } from "@/lib/blog/validate-blog-category";

const blogPostStatusSchema = z.enum(BLOG_POST_STATUS_VALUES);
const blogPostTypeSchema = z.enum(BLOG_POST_TYPE_VALUES);

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

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
    message: "El contenido no puede incluir encabezados H1. Usá H2–H6; el título del artículo es el H1 de la página.",
  });

const tagIdsSchema = z.array(z.coerce.number().int().positive()).optional().default([]);

const blogPostBaseFields = {
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z.string().trim().min(1).max(60).optional(),
  excerpt: optionalTrimmedString(500),
  contentJson: contentJsonSchema.optional(),
  heroImageUrl: optionalTrimmedString(2000),
  status: blogPostStatusSchema.optional(),
  type: blogPostTypeSchema.optional(),
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
  const slugResult = parseBlogSlug(slugSource);
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

export const blogPostCreateSchema = z
  .object(blogPostBaseFields)
  .transform((data) => ({
    ...data,
    slug: resolveSlug(data.title, data.slug),
    contentJson: (data.contentJson ?? createEmptyBlogContentJson()) as JSONContent,
    status: data.status ?? "DRAFT",
    type: data.type ?? "BLOG",
    noIndex: data.noIndex ?? false,
    isFeatured: data.isFeatured ?? false,
    tagIds: data.tagIds ?? [],
  }));

export const blogPostUpdateSchema = z
  .object({
    ...blogPostBaseFields,
    title: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.slug !== undefined) {
      const slugResult = parseBlogSlug(data.slug);
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
      const slugResult = parseBlogSlug(data.slug);
      if (slugResult.ok) {
        next.slug = slugResult.normalizedSlug;
      }
    }
    return next;
  });

export type BlogPostCreateInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;

export type PreparedBlogPostContent = {
  contentJson: JSONContent;
  contentHtml: string;
  readingTimeMin: number;
};

/** Normaliza JSON, genera HTML sanitizado y tiempo de lectura (servidor al guardar). */
export async function prepareBlogPostContent(
  contentJson: JSONContent
): Promise<PreparedBlogPostContent> {
  const normalizedJson = downgradeH1InContentJson(contentJson);
  const { generateBlogHtml } = await import("@/lib/blog/generate-blog-html");
  const contentHtml = await generateBlogHtml(normalizedJson);
  const readingTimeMin = calculateReadingTimeFromContentJson(normalizedJson);
  return {
    contentJson: normalizedJson,
    contentHtml,
    readingTimeMin,
  };
}

/**
 * Ajusta publishedAt al publicar.
 * Si pasa a PUBLISHED sin fecha, usa now. Si vuelve a DRAFT, conserva publishedAt histórico.
 */
export function resolvePublishedAtForStatus(
  status: BlogPostStatus,
  publishedAt: Date | null | undefined,
  existingPublishedAt?: Date | null
): Date | null {
  if (status === "PUBLISHED") {
    return publishedAt ?? existingPublishedAt ?? new Date();
  }
  return publishedAt ?? existingPublishedAt ?? null;
}

export function parseBlogPostCreate(body: unknown) {
  return blogPostCreateSchema.safeParse(body);
}

export function parseBlogPostUpdate(body: unknown) {
  return blogPostUpdateSchema.safeParse(body);
}

export { formatBlogValidationError, createEmptyBlogContentJson };
