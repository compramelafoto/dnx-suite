import { z } from "zod";
import { parseBlogSlug } from "@/lib/blog/slugify-blog";

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

export const blogCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    slug: z.string().trim().min(1, "El slug es obligatorio").max(60).optional(),
    description: optionalTrimmedString(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    isFeatured: z.boolean().optional().default(false),
  })
  .transform((data) => {
    const slugSource = data.slug?.trim() || data.name;
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
    return {
      ...data,
      slug: slugResult.normalizedSlug,
    };
  });

export const blogCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
    description: optionalTrimmedString(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isFeatured: z.boolean().optional(),
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
  })
  .transform((data) => {
    if (data.slug === undefined) return data;
    const slugResult = parseBlogSlug(data.slug);
    if (!slugResult.ok) return data;
    return { ...data, slug: slugResult.normalizedSlug };
  });

export type BlogCategoryCreateInput = z.infer<typeof blogCategoryCreateSchema>;
export type BlogCategoryUpdateInput = z.infer<typeof blogCategoryUpdateSchema>;

export function parseBlogCategoryCreate(body: unknown) {
  return blogCategoryCreateSchema.safeParse(body);
}

export function parseBlogCategoryUpdate(body: unknown) {
  return blogCategoryUpdateSchema.safeParse(body);
}

export function formatBlogValidationError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}
