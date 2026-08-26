import { z } from "zod";
import { parseContentSlug } from "../slug";
import { formatContentValidationError, optionalTrimmedString } from "./shared";

export const contentCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    slug: z.string().trim().min(1, "El slug es obligatorio").max(60).optional(),
    description: optionalTrimmedString(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    isFeatured: z.boolean().optional().default(false),
  })
  .transform((data) => {
    const slugSource = data.slug?.trim() || data.name;
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
    return {
      ...data,
      slug: slugResult.normalizedSlug,
    };
  });

export const contentCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
    description: optionalTrimmedString(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isFeatured: z.boolean().optional(),
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
  })
  .transform((data) => {
    if (data.slug === undefined) return data;
    const slugResult = parseContentSlug(data.slug);
    if (!slugResult.ok) return data;
    return { ...data, slug: slugResult.normalizedSlug };
  });

export type ContentCategoryCreateInput = z.infer<typeof contentCategoryCreateSchema>;
export type ContentCategoryUpdateInput = z.infer<typeof contentCategoryUpdateSchema>;

/** Alias CLF. */
export const blogCategoryCreateSchema = contentCategoryCreateSchema;
export const blogCategoryUpdateSchema = contentCategoryUpdateSchema;
export type BlogCategoryCreateInput = ContentCategoryCreateInput;
export type BlogCategoryUpdateInput = ContentCategoryUpdateInput;

export function parseContentCategoryCreate(body: unknown) {
  return contentCategoryCreateSchema.safeParse(body);
}

export function parseContentCategoryUpdate(body: unknown) {
  return contentCategoryUpdateSchema.safeParse(body);
}

export const parseBlogCategoryCreate = parseContentCategoryCreate;
export const parseBlogCategoryUpdate = parseContentCategoryUpdate;

export { formatContentValidationError, formatBlogValidationError } from "./shared";
