import { z } from "zod";
import { parseBlogSlug } from "@/lib/blog/slugify-blog";
import { formatBlogValidationError } from "@/lib/blog/validate-blog-category";

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

export const blogAuthorCreateSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    slug: z.string().trim().min(1).max(60).optional(),
    bio: optionalTrimmedString(2000),
    avatarUrl: optionalTrimmedString(2000),
    role: optionalTrimmedString(120),
    userId: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional().default(true),
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

export const blogAuthorUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(60).optional(),
    bio: optionalTrimmedString(2000),
    avatarUrl: optionalTrimmedString(2000),
    role: optionalTrimmedString(120),
    userId: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
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

export type BlogAuthorCreateInput = z.infer<typeof blogAuthorCreateSchema>;
export type BlogAuthorUpdateInput = z.infer<typeof blogAuthorUpdateSchema>;

export function parseBlogAuthorCreate(body: unknown) {
  return blogAuthorCreateSchema.safeParse(body);
}

export function parseBlogAuthorUpdate(body: unknown) {
  return blogAuthorUpdateSchema.safeParse(body);
}

export { formatBlogValidationError };
